use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn creates_policy_and_stores_owner() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);

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
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let id = client.create(&50_000_000_i128, &100_000_000_i128, &no_recipient, &owner);
    client.update(
        &id,
        &75_000_000_i128,
        &150_000_000_i128,
        &no_recipient,
        &owner,
    );

    let policy = client.get_policy(&id).unwrap();
    assert_eq!(policy.max_amount, 75_000_000_i128);
    assert_eq!(policy.daily_limit.unwrap(), 150_000_000_i128);
}

#[test]
fn enables_and_disables_policy() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);
    assert!(client.get_policy(&id).unwrap().enabled);

    client.set_enabled(&id, &false, &owner);
    assert!(!client.get_policy(&id).unwrap().enabled);

    client.set_enabled(&id, &true, &owner);
    assert!(client.get_policy(&id).unwrap().enabled);
}

#[test]
#[should_panic]
fn rejects_unauthorized_policy_update() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let intruder = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);

    let updated_no_recipient: Option<Address> = None;
    client.update(
        &id,
        &75_000_000_i128,
        &0_i128,
        &updated_no_recipient,
        &intruder,
    );
}

#[test]
#[should_panic]
fn rejects_unauthorized_policy_enable_disable() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let intruder = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);

    client.set_enabled(&id, &false, &intruder);
}

#[test]
fn validates_approved_payment() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let policy_id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);

    let destination = Address::generate(&env);
    let approved =
        client.validate_and_record(&policy_id, &owner, &destination, &10_000_000_i128, &owner);

    assert!(approved);
    assert_eq!(client.usage_count(), 1);
}

#[test]
fn rejects_payment_exceeding_policy_limit() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let sender = Address::generate(&env);

    let approved_recipient: Option<Address> = Some(owner.clone());
    let policy_id = client.create(&10_000_000_i128, &0_i128, &approved_recipient, &owner);

    let approved =
        client.validate_and_record(&policy_id, &sender, &owner, &20_000_000_i128, &owner);

    assert!(!approved);
    assert_eq!(client.usage_count(), 1);
}

#[test]
fn rejects_payment_from_unauthorized_recipient() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let unauthorized_destination = Address::generate(&env);

    let approved_recipient: Option<Address> = Some(owner.clone());
    let policy_id = client.create(&25_000_000_i128, &0_i128, &approved_recipient, &owner);

    let approved = client.validate_and_record(
        &policy_id,
        &owner,
        &unauthorized_destination,
        &10_000_000_i128,
        &owner,
    );

    assert!(!approved);
}

#[test]
fn rejects_payment_when_policy_disabled() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let policy_id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);

    client.set_enabled(&policy_id, &false, &owner);

    let destination = Address::generate(&env);
    let approved =
        client.validate_and_record(&policy_id, &owner, &destination, &10_000_000_i128, &owner);

    assert!(!approved);
}

#[test]
fn enforces_daily_limit() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let approved_recipient: Option<Address> = Some(owner.clone());
    let policy_id = client.create(
        &30_000_000_i128,
        &30_000_000_i128,
        &approved_recipient,
        &owner,
    );

    let approved1 =
        client.validate_and_record(&policy_id, &owner, &owner, &20_000_000_i128, &owner);
    assert!(approved1);

    let approved2 =
        client.validate_and_record(&policy_id, &owner, &owner, &20_000_000_i128, &owner);
    assert!(!approved2);
}

#[test]
fn emits_events_for_approval_and_rejection() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);
    let sender = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let policy_id = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);

    let destination = Address::generate(&env);
    let _ = client.validate_and_record(&policy_id, &sender, &destination, &10_000_000_i128, &owner);
    let _ =
        client.validate_and_record(&policy_id, &sender, &destination, &100_000_000_i128, &owner);

    assert_eq!(client.usage_count(), 2);

    let usages = client.recent_usage(&10);
    assert_eq!(usages.len(), 2);
    assert!(usages.get(0).unwrap().approved);
    assert!(!usages.get(1).unwrap().approved);
}

#[test]
fn returns_none_for_nonexistent_policy() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);

    assert_eq!(client.get_policy(&999), None);
    assert_eq!(client.get_owner(&999), None);
}

#[test]
fn lists_policies_by_owner() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    let contract_id = env.register(PaymentPolicy, ());
    let client = PaymentPolicyClient::new(&env, &contract_id);
    let owner = Address::generate(&env);

    let no_recipient: Option<Address> = None;
    let id1 = client.create(&25_000_000_i128, &0_i128, &no_recipient, &owner);
    let id2 = client.create(&50_000_000_i128, &0_i128, &no_recipient, &owner);

    let policies = client.get_policies_by_owner(&owner);
    assert_eq!(policies.len(), 2);
    assert!(policies.contains(&client.get_policy(&id1).unwrap()));
    assert!(policies.contains(&client.get_policy(&id2).unwrap()));
}
