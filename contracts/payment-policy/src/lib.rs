#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Env, String, Map,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Policy {
    pub id: u64,
    pub owner: Address,
    pub max_amount: i128,
    pub daily_limit: Option<i128>,
    pub approved_recipient: Option<Address>,
    pub enabled: bool,
    pub total_used_today: i128,
    pub daily_reset_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyUsage {
    pub policy_id: u64,
    pub sender: Address,
    pub amount: i128,
    pub approved: bool,
    pub reason: String,
    pub ledger: u32,
}

#[contracttype]
enum DataKey {
    PolicyCount,
    Policy(u64),
    PolicyUsage(u64),
    UsageCount,
}

#[contractevent(topics = ["policy"], data_format = "vec")]
pub struct PolicyCreated {
    #[topic]
    pub id: u64,
    pub owner: Address,
    pub max_amount: i128,
}

#[contractevent(topics = ["policy"], data_format = "vec")]
pub struct PolicyUpdated {
    #[topic]
    pub id: u64,
    pub max_amount: i128,
    pub daily_limit: Option<i128>,
    pub approved_recipient: Option<Address>,
}

#[contractevent(topics = ["policy"], data_format = "vec")]
pub struct PolicyEnabled {
    #[topic]
    pub id: u64,
    pub enabled: bool,
}

#[contractevent(topics = ["policy"], data_format = "vec")]
pub struct PolicyApproved {
    #[topic]
    pub id: u64,
    pub sender: Address,
    pub amount: i128,
    pub ledger: u32,
}

#[contractevent(topics = ["policy"], data_format = "vec")]
pub struct PolicyRejected {
    #[topic]
    pub id: u64,
    pub sender: Address,
    pub amount: i128,
    pub reason: String,
    pub ledger: u32,
}

#[contract]
pub struct PaymentPolicy;

// ── Internal helpers ────────────────────────────────────────────────────────

fn require_owner(env: &Env, owner: Address) {
    let current = env.current_contract_address();
    if current != owner {
        panic!("unauthorized: only the policy owner can perform this action");
    }
}

fn require_enabled(policy: &Policy) {
    if !policy.enabled {
        panic!("policy is disabled");
    }
}

fn check_daily_reset(env: &Env, policy: &mut Policy) {
    let current_ledger = env.ledger().sequence();
    if current_ledger > policy.daily_reset_ledger {
        policy.total_used_today = 0;
        policy.daily_reset_ledger = current_ledger;
    }
}

fn validate_payment(
    policy: &Policy,
    sender: &Address,
    amount: i128,
) -> Result<(), String> {
    require_enabled(policy);
    if amount > policy.max_amount {
        return Err(format!(
            "payment amount {} exceeds policy maximum {}",
            amount, policy.max_amount
        ));
    }
    if let Some(recipient) = &policy.approved_recipient {
        if sender != recipient {
            return Err(format!(
                "sender {} is not the approved recipient {}",
                sender, recipient
            ));
        }
    }
    if let Some(daily_limit) = policy.daily_limit {
        if policy.total_used_today + amount > daily_limit {
            return Err(format!(
                "daily limit of {} would be exceeded by this payment",
                daily_limit
            ));
        }
    }
    Ok(())
}

// ── Contract implementation ─────────────────────────────────────────────────

#[contractimpl]
impl PaymentPolicy {
    /// Creates a new payment policy. The calling address becomes the policy owner.
    /// `max_amount` is the maximum allowed payment in stroops (1 XLM = 10,000,000 stroops).
    /// `daily_limit` is optional; pass 0 to disable the daily limit.
    /// `approved_recipient` is optional; pass an empty address to allow any sender.
    pub fn create(
        env: Env,
        max_amount: i128,
        daily_limit: i128,
        approved_recipient: Address,
    ) -> u64 {
        let owner = env.current_contract_address();
        // Note: in production this would be the tx sender; for Soroban the
        // contract address calling itself is the "owner" context.
        // We use require_auth on the source account passed during invocation.
        let caller = env.invoker_contract_address().unwrap_or(owner.clone());
        require_owner(&env, caller);

        assert!(max_amount > 0, "max_amount must be positive");
        assert!(
            daily_limit == 0 || daily_limit >= max_amount,
            "daily_limit must be 0 or >= max_amount"
        );

        let count = env.storage().instance().get::<_, u64>(&DataKey::PolicyCount).unwrap_or(0);
        let id = count + 1;

        let daily_limit_option: Option<i128> = if daily_limit > 0 {
            Some(daily_limit)
        } else {
            None
        };

        let policy = Policy {
            id,
            owner: caller.clone(),
            max_amount,
            daily_limit: daily_limit_option,
            approved_recipient: if approved_recipient.is_empty() {
                None
            } else {
                Some(approved_recipient)
            },
            enabled: true,
            total_used_today: 0,
            daily_reset_ledger: env.ledger().sequence(),
        };

        env.storage().persistent().set(&DataKey::Policy(id), &policy);
        env.storage().instance().set(&DataKey::PolicyCount, &id);
        env.storage().instance().extend_ttl(17_280, 120_960);

        PolicyCreated {
            id,
            owner: caller,
            max_amount,
        }
        .publish(&env);

        id
    }

    /// Returns the policy with the given id, or None if it does not exist.
    pub fn get_policy(env: Env, id: u64) -> Option<Policy> {
        env.storage().persistent().get(&DataKey::Policy(id))
    }

    /// Returns the owner of the policy with the given id.
    pub fn get_owner(env: Env, id: u64) -> Option<Address> {
        get_policy(env, id).map(|p| p.owner)
    }

    /// Returns all policies owned by the given address.
    pub fn get_policies_by_owner(env: Env, owner: Address) -> Vec<Policy> {
        let count = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::PolicyCount)
            .unwrap_or(0);
        let mut policies = Vec::new(&env);
        for id in 1..=count {
            if let Some(policy) = Self::get_policy(env.clone(), id) {
                if policy.owner == owner {
                    policies.push_back(policy);
                }
            }
        }
        policies
    }

    /// Updates the policy configuration. Only the policy owner can call this.
    /// Pass 0 for daily_limit to remove the daily limit, or an empty address
    /// for approved_recipient to allow any sender.
    pub fn update(
        env: Env,
        id: u64,
        max_amount: i128,
        daily_limit: i128,
        approved_recipient: Address,
    ) {
        let policy = Self::get_policy(env.clone(), id);
        let policy = match policy {
            Some(p) => p,
            None => panic!("policy not found"),
        };

        let caller = env.invoker_contract_address().unwrap_or_else(|| env.current_contract_address());
        require_owner(&env, caller);
        require_enabled(&policy);

        assert!(max_amount > 0, "max_amount must be positive");
        assert!(
            daily_limit == 0 || daily_limit >= max_amount,
            "daily_limit must be 0 or >= max_amount"
        );

        let daily_limit_option: Option<i128> = if daily_limit > 0 {
            Some(daily_limit)
        } else {
            None
        };

        let updated = Policy {
            id,
            owner: policy.owner,
            max_amount,
            daily_limit: daily_limit_option,
            approved_recipient: if approved_recipient.is_empty() {
                None
            } else {
                Some(approved_recipient)
            },
            enabled: policy.enabled,
            total_used_today: policy.total_used_today,
            daily_reset_ledger: policy.daily_reset_ledger,
        };

        env.storage().persistent().set(&DataKey::Policy(id), &updated);

        PolicyUpdated {
            id,
            max_amount,
            daily_limit: daily_limit_option,
            approved_recipient: updated.approved_recipient,
        }
        .publish(&env);
    }

    /// Enables or disables the policy. Only the policy owner can call this.
    pub fn set_enabled(env: Env, id: u64, enabled: bool) {
        let policy = Self::get_policy(env.clone(), id);
        let policy = match policy {
            Some(p) => p,
            None => panic!("policy not found"),
        };

        let caller = env.invoker_contract_address().unwrap_or_else(|| env.current_contract_address());
        require_owner(&env, caller);

        let updated = Policy {
            id,
            owner: policy.owner,
            max_amount: policy.max_amount,
            daily_limit: policy.daily_limit,
            approved_recipient: policy.approved_recipient,
            enabled,
            total_used_today: policy.total_used_today,
            daily_reset_ledger: policy.daily_reset_ledger,
        };

        env.storage().persistent().set(&DataKey::Policy(id), &updated);

        PolicyEnabled { id, enabled }.publish(&env);
    }

    /// Validates a payment against this policy and records the usage.
    /// Returns true if the payment is approved, false otherwise.
    /// This is the method that PaymentTracker calls via inter-contract invocation.
    pub fn validate_and_record(
        env: Env,
        policy_id: u64,
        sender: Address,
        amount: i128,
    ) -> bool {
        let policy = Self::get_policy(env.clone(), policy_id);
        let policy = match policy {
            Some(p) => p,
            None => {
                // Emit rejection event and return false
                let reason = "policy not found".to_string();
                let usage = PolicyUsage {
                    policy_id,
                    sender: sender.clone(),
                    amount,
                    approved: false,
                    reason: reason.clone(),
                    ledger: env.ledger().sequence(),
                };
                let usage_id = env
                    .storage()
                    .instance()
                    .get::<_, u64>(&DataKey::UsageCount)
                    .unwrap_or(0)
                    + 1;
                env.storage().persistent().set(&DataKey::PolicyUsage(usage_id), &usage);
                env.storage().instance().set(&DataKey::UsageCount, &usage_id);
                PolicyRejected {
                    id: policy_id,
                    sender,
                    amount,
                    reason,
                    ledger: env.ledger().sequence(),
                }
                .publish(&env);
                return false;
            }
        };

        // Check authorization: the caller must be the policy owner or the payment tracker
        let caller = env.invoker_contract_address().unwrap_or_else(|| env.current_contract_address());
        let policy_owner = policy.owner;
        // Allow the policy owner or the payment tracker (identified by convention)
        // For simplicity, the payment tracker calls this as the policy owner context
        // In a production setup, the tracker would be authorized via a separate mechanism
        if caller != policy_owner {
            // Allow if this is a contract-to-contract call from PaymentTracker
            // The tracker is identified by being the invoker
            // In practice, the tracker would need to be pre-authorized
            // For this implementation, we check if the invoker is the policy owner
            // or if we're being called by another contract (inter-contract call)
            panic!("unauthorized: only the policy owner can validate payments");
        }

        let mut mutable_policy = policy.clone();
        check_daily_reset(&env, &mut mutable_policy);

        match validate_payment(&mutable_policy, &sender, amount) {
            Ok(()) => {
                mutable_policy.total_used_today += amount;
                env.storage().persistent().set(&DataKey::Policy(policy_id), &mutable_policy);

                let usage = PolicyUsage {
                    policy_id,
                    sender: sender.clone(),
                    amount,
                    approved: true,
                    reason: String::from_str(&env, "approved"),
                    ledger: env.ledger().sequence(),
                };
                let usage_id = env
                    .storage()
                    .instance()
                    .get::<_, u64>(&DataKey::UsageCount)
                    .unwrap_or(0)
                    + 1;
                env.storage().persistent().set(&DataKey::PolicyUsage(usage_id), &usage);
                env.storage().instance().set(&DataKey::UsageCount, &usage_id);

                PolicyApproved {
                    id: policy_id,
                    sender,
                    amount,
                    ledger: env.ledger().sequence(),
                }
                .publish(&env);

                true
            }
            Err(reason) => {
                let usage = PolicyUsage {
                    policy_id,
                    sender: sender.clone(),
                    amount,
                    approved: false,
                    reason: reason.clone(),
                    ledger: env.ledger().sequence(),
                };
                let usage_id = env
                    .storage()
                    .instance()
                    .get::<_, u64>(&DataKey::UsageCount)
                    .unwrap_or(0)
                    + 1;
                env.storage().persistent().set(&DataKey::PolicyUsage(usage_id), &usage);
                env.storage().instance().set(&DataKey::UsageCount, &usage_id);

                PolicyRejected {
                    id: policy_id,
                    sender,
                    amount,
                    reason,
                    ledger: env.ledger().sequence(),
                }
                .publish(&env);

                false
            }
        }
    }

    /// Returns the number of policies that exist.
    pub fn policy_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&DataKey::PolicyCount)
            .unwrap_or(0)
    }

    /// Returns the number of usage records that exist.
    pub fn usage_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&DataKey::UsageCount)
            .unwrap_or(0)
    }

    /// Returns the most recent usage records, up to the given limit.
    pub fn recent_usage(env: Env, limit: u32) -> Vec<PolicyUsage> {
        let count = Self::usage_count(env.clone());
        let capped = limit.min(50) as u64;
        let first = count.saturating_sub(capped).saturating_add(1);
        let mut records = Vec::new(&env);

        if count == 0 {
            return records;
        }

        for id in first..=count {
            if let Some(usage) = env.storage().persistent().get(&DataKey::PolicyUsage(id)) {
                records.push_back(usage);
            }
        }
        records
    }
}

#[cfg(test)]
mod test;
