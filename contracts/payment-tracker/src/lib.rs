#![no_std]
use soroban_sdk::{
    contract, contractclient, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Vec,
};

#[contractclient(name = "PaymentPolicyClient")]
pub trait PaymentPolicy {
    fn validate_and_record(
        env: Env,
        policy_id: u64,
        sender: Address,
        destination: Address,
        amount: i128,
        caller: Address,
    ) -> bool;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    pub id: u64,
    pub sender: Address,
    pub destination: Address,
    pub amount: i128,
    pub memo: String,
    pub ledger: u32,
    pub policy_id: Option<u64>,
    pub policy_approved: bool,
    pub policy_contract: Option<Address>,
}

#[contracttype]
enum DataKey {
    Count,
    Payment(u64),
}

#[contractevent(topics = ["payment"], data_format = "vec")]
pub struct PaymentRecorded {
    #[topic]
    pub sender: Address,
    pub id: u64,
    pub destination: Address,
    pub amount: i128,
    pub memo: String,
    pub policy_id: Option<u64>,
    pub policy_approved: bool,
}

#[contractevent(topics = ["payment"], data_format = "vec")]
pub struct PaymentRejected {
    #[topic]
    pub sender: Address,
    pub id: u64,
    pub destination: Address,
    pub amount: i128,
    pub reason: String,
    pub policy_id: Option<u64>,
}

#[contract]
pub struct PaymentTracker;

#[contractimpl]
impl PaymentTracker {
    /// Records a payment without policy validation.
    /// Amount is expressed in stroops (1 XLM = 10,000,000 stroops).
    pub fn record(
        env: Env,
        sender: Address,
        destination: Address,
        amount: i128,
        memo: String,
    ) -> u64 {
        sender.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(memo.len() <= 64, "memo is too long");

        let id = Self::next_id(&env);
        let record = PaymentRecord {
            id,
            sender: sender.clone(),
            destination: destination.clone(),
            amount,
            memo: memo.clone(),
            ledger: env.ledger().sequence(),
            policy_id: None,
            policy_approved: true,
            policy_contract: None,
        };

        Self::store_record(&env, id, &record);

        PaymentRecorded {
            sender,
            id,
            destination,
            amount,
            memo,
            policy_id: None,
            policy_approved: true,
        }
        .publish(&env);

        id
    }

    /// Records a payment with optional policy validation via inter-contract call.
    /// If a policy_contract and policy_id are provided, the payment is validated
    /// against the policy before being recorded. The policy decision is stored
    /// with the payment record.
    ///
    /// This demonstrates real inter-contract communication: the PaymentTracker
    /// contract invokes the PaymentPolicy contract to validate the payment.
    pub fn record_with_policy(
        env: Env,
        sender: Address,
        destination: Address,
        amount: i128,
        memo: String,
        policy_contract: Address,
        policy_id: u64,
        token_contract: Address,
    ) -> u64 {
        sender.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(memo.len() <= 64, "memo is too long");

        assert!(policy_id > 0, "policy_id must be positive");

        let policy_client = PaymentPolicyClient::new(&env, &policy_contract);
        let approved =
            policy_client.validate_and_record(&policy_id, &sender, &destination, &amount, &sender);
        assert!(approved, "payment rejected by policy");

        // Transfer the native asset only after policy approval. Because this is a
        // nested contract invocation, validation, transfer, and recording are atomic.
        let token_client = token::Client::new(&env, &token_contract);
        token_client.transfer(&sender, &destination, &amount);

        let id = Self::next_id(&env);
        let record = PaymentRecord {
            id,
            sender: sender.clone(),
            destination: destination.clone(),
            amount,
            memo: memo.clone(),
            ledger: env.ledger().sequence(),
            policy_id: Some(policy_id),
            policy_approved: true,
            policy_contract: Some(policy_contract),
        };

        Self::store_record(&env, id, &record);

        PaymentRecorded {
            sender,
            id,
            destination,
            amount,
            memo,
            policy_id: Some(policy_id),
            policy_approved: true,
        }
        .publish(&env);

        id
    }

    pub fn count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn get(env: Env, id: u64) -> Option<PaymentRecord> {
        env.storage().persistent().get(&DataKey::Payment(id))
    }

    pub fn recent(env: Env, limit: u32) -> Vec<PaymentRecord> {
        let count = Self::count(env.clone());
        let capped = limit.min(20) as u64;
        let first = count.saturating_sub(capped).saturating_add(1);
        let mut records = Vec::from_array(&env, []);

        if count == 0 {
            return records;
        }

        let mut id = count;
        while id >= first {
            if let Some(record) = Self::get(env.clone(), id) {
                records.push_back(record);
            }
            if id == first {
                break;
            }
            id -= 1;
        }
        records
    }

    /// Returns all payments that used a specific policy.
    pub fn payments_by_policy(env: Env, policy_id: u64) -> Vec<PaymentRecord> {
        let count = Self::count(env.clone());
        let mut records = Vec::from_array(&env, []);

        for id in 1..=count {
            if let Some(record) = Self::get(env.clone(), id) {
                if record.policy_id == Some(policy_id) {
                    records.push_back(record);
                }
            }
        }
        records
    }

    fn next_id(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get::<_, u64>(&DataKey::Count)
            .unwrap_or(0)
            + 1
    }

    fn store_record(env: &Env, id: u64, record: &PaymentRecord) {
        env.storage()
            .persistent()
            .set(&DataKey::Payment(id), record);
        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(17_280, 120_960);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Payment(id), 17_280, 120_960);
    }
}

#[cfg(test)]
mod test;
