use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn records_and_reads_payments() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PaymentTracker, ());
    let client = PaymentTrackerClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let destination = Address::generate(&env);

    let id = client.record(
        &sender,
        &destination,
        &25_000_000_i128,
        &String::from_str(&env, "invoice-42"),
    );

    assert_eq!(id, 1);
    assert_eq!(client.count(), 1);
    let record = client.get(&1).unwrap();
    assert_eq!(record.amount, 25_000_000_i128);
    assert_eq!(record.sender, sender);
    assert_eq!(client.recent(&10).len(), 1);
}

#[test]
fn records_payment_with_policy_reference() {
    let env = Env::default();
    env.mock_all_auths();
    let tracker_id = env.register(PaymentTracker, ());
    let tracker_client = PaymentTrackerClient::new(&env, &tracker_id);

    let policy_addr = Address::generate(&env);
    let policy_id = 1u64;

    let sender = Address::generate(&env);
    let destination = Address::generate(&env);

    let id = tracker_client.record_with_policy(
        &sender,
        &destination,
        &25_000_000_i128,
        &String::from_str(&env, "policy-protected payment"),
        &policy_addr,
        &policy_id,
    );

    assert_eq!(id, 1);
    let record = tracker_client.get(&1).unwrap();
    assert_eq!(record.policy_id, Some(policy_id));
    assert!(record.policy_approved);
    assert_eq!(record.policy_contract, Some(policy_addr));

    let policy_payments = tracker_client.payments_by_policy(&policy_id);
    assert_eq!(policy_payments.len(), 1);
    assert_eq!(policy_payments[0].id, 1);
}

#[test]
fn records_multiple_payments_with_different_policies() {
    let env = Env::default();
    env.mock_all_auths();
    let tracker_id = env.register(PaymentTracker, ());
    let tracker_client = PaymentTrackerClient::new(&env, &tracker_id);

    let policy_a = Address::generate(&env);
    let policy_b = Address::generate(&env);
    let sender = Address::generate(&env);

    let id1 = tracker_client.record_with_policy(
        &sender,
        &Address::generate(&env),
        &10_000_000_i128,
        &String::from_str(&env, "via policy A"),
        &policy_a,
        &1u64,
    );

    let id2 = tracker_client.record_with_policy(
        &sender,
        &Address::generate(&env),
        &20_000_000_i128,
        &String::from_str(&env, "via policy B"),
        &policy_b,
        &2u64,
    );

    let id3 = tracker_client.record(
        &sender,
        &Address::generate(&env),
        &15_000_000_i128,
        &String::from_str(&env, "no policy"),
    );

    assert_eq!(tracker_client.count(), 3);

    let pa_payments = tracker_client.payments_by_policy(&1u64);
    assert_eq!(pa_payments.len(), 1);
    assert_eq!(pa_payments[0].id, id1);

    let pb_payments = tracker_client.payments_by_policy(&2u64);
    assert_eq!(pb_payments.len(), 1);
    assert_eq!(pb_payments[0].id, id2);
}

#[test]
fn recent_returns_most_recent_first() {
    let env = Env::default();
    env.mock_all_auths();
    let tracker_id = env.register(PaymentTracker, ());
    let tracker_client = PaymentTrackerClient::new(&env, &tracker_id);

    let sender = Address::generate(&env);

    for i in 1..=5 {
        tracker_client.record(
            &sender,
            &Address::generate(&env),
            &i * 10_000_000_i128,
            &String::from_str(&env, &format!("payment-{}", i)),
        );
    }

    let recent = tracker_client.recent(&3);
    assert_eq!(recent.len(), 3);
    assert_eq!(recent[0].id, 5);
    assert_eq!(recent[1].id, 4);
    assert_eq!(recent[2].id, 3);
}

#[test]
fn recent_respects_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let tracker_id = env.register(PaymentTracker, ());
    let tracker_client = PaymentTrackerClient::new(&env, &tracker_id);

    let sender = Address::generate(&env);

    for _ in 0..25 {
        tracker_client.record(
            &sender,
            &Address::generate(&env),
            &10_000_000_i128,
            &String::from_str(&env, "payment"),
        );
    }

    let recent = tracker_client.recent(&50);
    assert_eq!(recent.len(), 20);

    let recent_small = tracker_client.recent(&5);
    assert_eq!(recent_small.len(), 5);
}

#[test]
fn get_returns_none_for_nonexistent_payment() {
    let env = Env::default();
    env.mock_all_auths();
    let tracker_id = env.register(PaymentTracker, ());
    let tracker_client = PaymentTrackerClient::new(&env, &tracker_id);

    assert_eq!(tracker_client.get(&999), None);
}

#[test]
fn preserves_backward_compatibility_without_policy() {
    let env = Env::default();
    env.mock_all_auths();
    let tracker_id = env.register(PaymentTracker, ());
    let tracker_client = PaymentTrackerClient::new(&env, &tracker_id);

    let sender = Address::generate(&env);
    let destination = Address::generate(&env);

    let id = tracker_client.record(
        &sender,
        &destination,
        &50_000_000_i128,
        &String::from_str(&env, "legacy payment"),
    );

    let record = tracker_client.get(&id).unwrap();
    assert_eq!(record.policy_id, None);
    assert_eq!(record.policy_contract, None);
    assert!(record.policy_approved);
}
