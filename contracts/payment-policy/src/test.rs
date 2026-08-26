use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn creates_policy_and_stores_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let id = client.create(
        &25_000_000_i128,
        &0_i128,
        &Address::generate(&env), // empty address = no approved recipient restriction
    );

    assert_eq!(id, 1);
    assert_eq!(client.policy_count(), 1);

    let policy = client.get_policy(&1).unwrap();
    assert_eq!(policy.max_amount, 25_000_000_i128);
    assert!(policy.enabled);
    assert!(policy.daily_limit.is_none());
    assert!(policy.approved_recipient.is_none());
}

#[test]
fn updates_policy_configuration() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let id = client.create(
        &50_000_000_i128,
        &100_000_000_i128,
        &Address::generate(&env),
    );

    client.update(
        &id,
        &75_000_000_i128,
        &150_000_000_i128,
        &owner,
    );

    let policy = client.get_policy(&id).unwrap();
    assert_eq!(policy.max_amount, 75_000_000_i128);
    assert_eq!(policy.daily_limit.unwrap(), 150_000_000_i128);
}

#[test]
fn enables_and_disables_policy() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let id = client.create(&25_000_000_i128, &0_i128, &Address::generate(&env));
    assert!(client.get_policy(&id).unwrap().enabled);

    client.set_enabled(&id, false);
    assert!(!client.get_policy(&id).unwrap().enabled);

    client.set_enabled(&id, true);
    assert!(client.get_policy(&id).unwrap().enabled);
}

#[test]
fn rejects_unauthorized_policy_update() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let intruder = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let id = client.create(&25_000_000_i128, &0_i128, &Address::generate(&env));

    // Set the invoker to the intruder for the next call
    env.set_invoker_contract_address(intruder);

    let result = std::panic::catch_unwind(|| {
        client.update(
            &id,
            &75_000_000_i128,
            &0_i128,
            &Address::generate(&env),
        );
    });

    assert!(result.is_err());
}

#[test]
fn rejects_unauthorized_policy_enable_disable() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let intruder = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let id = client.create(&25_000_000_i128, &0_i128, &Address::generate(&env));

    env.set_invoker_contract_address(intruder);

    let result = std::panic::catch_unwind(|| {
        client.set_enabled(&id, false);
    });

    assert!(result.is_err());
}

#[test]
fn validates_approved_payment() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let sender = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    // Create policy where owner is also the approved recipient
    let policy_id = client.create(
        &25_000_000_i128,
        &0_i128,
        &owner,
    );

    // Set invoker to owner for validation
    env.set_invoker_contract_address(owner);

    let approved = client.validate_and_record(
        &policy_id,
        &sender,
        &10_000_000_i128,
    );

    assert!(approved);
    assert_eq!(client.usage_count(), 1);
}

#[test]
fn rejects_payment_exceeding_policy_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let sender = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let policy_id = client.create(
        &10_000_000_i128, // max 1 XLM
        &0_i128,
        &owner,
    );

    env.set_invoker_contract_address(owner);

    let approved = client.validate_and_record(
        &policy_id,
        &sender,
        &20_000_000_i128, // exceeds 1 XLM limit
    );

    assert!(!approved);
    assert_eq!(client.usage_count(), 1);
}

#[test]
fn rejects_payment_from_unauthorized_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let unauthorized_sender = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    // Policy only allows payments from owner
    let policy_id = client.create(
        &25_000_000_i128,
        &0_i128,
        &owner,
    );

    env.set_invoker_contract_address(owner);

    let approved = client.validate_and_record(
        &policy_id,
        &unauthorized_sender,
        &10_000_000_i128,
    );

    assert!(!approved);
}

#[test]
fn rejects_payment_when_policy_disabled() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let sender = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let policy_id = client.create(
        &25_000_000_i128,
        &0_i128,
        &owner,
    );

    // Disable the policy
    client.set_enabled(&policy_id, false);

    env.set_invoker_contract_address(owner);

    let approved = client.validate_and_record(
        &policy_id,
        &sender,
        &10_000_000_i128,
    );

    assert!(!approved);
}

#[test]
fn enforces_daily_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let policy_id = client.create(
        &50_000_000_i128,
        &30_000_000_i128, // daily limit of 3 XLM
        &owner,
    );

    env.set_invoker_contract_address(owner);

    // First payment: 2 XLM, should be approved
    let approved1 = client.validate_and_record(
        &policy_id,
        &owner,
        &20_000_000_i128,
    );
    assert!(approved1);

    // Second payment: 2 XLM, would exceed daily limit of 3 XLM
    let approved2 = client.validate_and_record(
        &policy_id,
        &owner,
        &20_000_000_i128,
    );
    assert!(!approved2);
}

#[test]
fn emits_events_for_approval_and_rejection() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let sender = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let policy_id = client.create(&25_000_000_i128, &0_i128, &owner);
    env.set_invoker_contract_address(owner);

    // Approved payment
    let _ = client.validate_and_record(&policy_id, &sender, &10_000_000_i128);

    // Rejection: payment exceeds limit
    let _ = client.validate_and_record(&policy_id, &sender, &100_000_000_i128);

    // Verify both usage records exist
    assert_eq!(client.usage_count(), 2);

    let usages = client.recent_usage(&10);
    assert_eq!(usages.len(), 2);
    assert!(usages[0].approved); // most recent is rejection
    assert!(!usages[1].approved); // older is approval
}

#[test]
fn returns_none_for_nonexistent_policy() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);

    assert_eq!(client.get_policy(&999), None);
    assert_eq!(client.get_owner(&999), None);
}

#[test]
fn lists_policies_by_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    env.register_contract_wasm(contract_id, owner);

    let id1 = client.create(&25_000_000_i128, &0_i128, &Address::generate(&env));
    let id2 = client.create(&50_000_000_i128, &0_i128, &Address::generate(&env));

    let policies = client.get_policies_by_owner(&owner);
    assert_eq!(policies.len(), 2);
    assert!(policies.contains(&client.get_policy(&id1).unwrap()));
    assert!(policies.contains(&client.get_policy(&id2).unwrap()));
}
