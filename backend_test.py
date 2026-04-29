"""
Focused backend test for the review request:
Cancelled Purchases in Vendor Ledger (Phase 3) — verify the new
DELETE /api/vendor-procurement/{id}?reason=... endpoint and its effects
on stock, vendor.outstanding_dues, and vendor ledger transactions/summary.
"""
import os
import uuid
import json
import requests

BASE_URL = os.environ.get(
    "BACKEND_URL",
    "https://transaction-mgmt-dev.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"username": "admin", "password": "admin123"}
TAG = f"TEST_{uuid.uuid4().hex[:8]}"


def _ok(label, cond, extra=""):
    print(f"{'PASS' if cond else 'FAIL'} | {label}{(' — ' + extra) if extra else ''}")
    return cond


def login_admin():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token in response: {r.text}"
    return {"Authorization": f"Bearer {token}"}


def ensure_product(headers):
    r = requests.get(f"{API}/products", headers=headers, timeout=30)
    r.raise_for_status()
    products = r.json()
    active = [p for p in products if p.get("is_active", True)]
    assert active, "No active product exists for testing"
    return active[0]


def ensure_outlet(headers):
    r = requests.get(f"{API}/outlets", headers=headers, timeout=30)
    r.raise_for_status()
    outlets = r.json()
    active = [o for o in outlets if o.get("is_active", True)]
    assert active, "No active outlet exists"
    return active[0]


def create_test_vendor(headers):
    payload = {
        "name": f"Shree Traders {TAG}",
        "mobile": "9988776655",
        "address": "Main Market, Bharatpur",
        "village": "Bharatpur",
    }
    r = requests.post(f"{API}/vendors", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, f"Vendor create failed: {r.status_code} {r.text}"
    return r.json()


def get_vendor(headers, vendor_id):
    r = requests.get(f"{API}/vendors", headers=headers, timeout=30)
    r.raise_for_status()
    for v in r.json():
        if v.get("id") == vendor_id:
            return v
    return None


def get_stock_qty(headers, outlet_id, product_id):
    r = requests.get(f"{API}/stock", headers=headers, timeout=30)
    r.raise_for_status()
    for s in r.json():
        if s.get("outlet_id") == outlet_id and s.get("product_id") == product_id:
            return s.get("quantity", 0)
    return 0


def main():
    print(f"\n== Backend URL: {BASE_URL}  Tag: {TAG} ==\n")
    failures = []

    def check(label, cond, extra=""):
        ok = _ok(label, cond, extra)
        if not ok:
            failures.append(label)
        return ok

    # 1. Auth
    headers = login_admin()
    check("Admin login (admin/admin123)", True)

    # 2. Setup
    product = ensure_product(headers)
    outlet = ensure_outlet(headers)
    vendor_resp = create_test_vendor(headers)
    vendor_id = (
        vendor_resp.get("id")
        if isinstance(vendor_resp, dict)
        else None
    )
    if not vendor_id:
        # Fallback: search by TAG
        r = requests.get(f"{API}/vendors", headers=headers, timeout=30)
        for v in r.json():
            if TAG in v.get("name", ""):
                vendor_id = v["id"]
                break
    assert vendor_id, f"Couldn't resolve vendor id from {vendor_resp}"
    check("Vendor created", True, f"id={vendor_id}")

    vendor_before = get_vendor(headers, vendor_id) or {}
    dues_before = vendor_before.get("outstanding_dues", 0)
    total_purchases_before = vendor_before.get("total_purchases", 0)
    txn_count_before = vendor_before.get("transaction_count", 0)
    stock_before = get_stock_qty(headers, outlet["id"], product["id"])
    print(
        f"   Baseline: outstanding_dues={dues_before}, total_purchases={total_purchases_before}, "
        f"transaction_count={txn_count_before}, stock_qty={stock_before}"
    )

    # 3. Create a credit procurement so outstanding_dues increases
    qty = 10.0
    rate = 50.0
    expected_total = qty * rate  # 500
    proc_payload = {
        "vendor_id": vendor_id,
        "product_id": product["id"],
        "quantity": qty,
        "rate": rate,
        "outlet_id": outlet["id"],
        "payment_mode": "credit",
        "cash_amount": 0,
        "online_amount": 0,
        "notes": f"Credit purchase {TAG}",
    }
    r = requests.post(f"{API}/vendor-procurement", headers=headers, json=proc_payload, timeout=30)
    if not check(
        "POST /api/vendor-procurement (credit)",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:200]}",
    ):
        return failures
    proc_body = r.json()
    procurement_id = proc_body.get("procurement_id")
    receipt_number = proc_body.get("receipt_number")
    check("procurement_id returned", bool(procurement_id), f"id={procurement_id}")

    # Verify dues/stock went up
    vendor_mid = get_vendor(headers, vendor_id) or {}
    dues_mid = vendor_mid.get("outstanding_dues", 0)
    total_purchases_mid = vendor_mid.get("total_purchases", 0)
    txn_count_mid = vendor_mid.get("transaction_count", 0)
    stock_mid = get_stock_qty(headers, outlet["id"], product["id"])
    check(
        "outstanding_dues increased by credit_amount",
        abs((dues_mid - dues_before) - expected_total) < 1e-6,
        f"{dues_before} -> {dues_mid} (delta expected {expected_total})",
    )
    check(
        "total_purchases increased",
        abs((total_purchases_mid - total_purchases_before) - expected_total) < 1e-6,
        f"{total_purchases_before} -> {total_purchases_mid}",
    )
    check(
        "transaction_count +1",
        (txn_count_mid - txn_count_before) == 1,
        f"{txn_count_before} -> {txn_count_mid}",
    )
    check(
        "stock +quantity at outlet",
        abs((stock_mid - stock_before) - qty) < 1e-6,
        f"{stock_before} -> {stock_mid}",
    )

    # 4. DELETE /api/vendor-procurement/{id}?reason=test cancel -> expect 200
    reason = "test cancel"
    r = requests.delete(
        f"{API}/vendor-procurement/{procurement_id}",
        headers=headers,
        params={"reason": reason},
        timeout=30,
    )
    delete_ok = check(
        "DELETE /api/vendor-procurement/{id}?reason=test%20cancel",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:300]}",
    )
    if not delete_ok:
        return failures
    del_body = r.json()
    print(f"   delete response: {json.dumps(del_body, default=str)[:400]}")
    check(
        "delete.reversal_details.stock_reversed == True",
        del_body.get("reversal_details", {}).get("stock_reversed") is True,
    )
    check(
        "delete.reversal_details.vendor_ledger_adjusted == True",
        del_body.get("reversal_details", {}).get("vendor_ledger_adjusted") is True,
    )

    # 5. Fetch vendor ledger & verify cancelled appearance
    r = requests.get(f"{API}/vendors/{vendor_id}/ledger", headers=headers, timeout=30)
    if not check("GET /api/vendors/{id}/ledger", r.status_code == 200, f"status={r.status_code}"):
        return failures
    ledger = r.json()
    transactions = ledger.get("transactions", [])
    summary = ledger.get("summary", {})

    cancelled_txn = None
    for t in transactions:
        if t.get("id") == procurement_id:
            cancelled_txn = t
            break

    check("cancelled purchase present in ledger.transactions", cancelled_txn is not None)
    if cancelled_txn is not None:
        check(
            "transaction.is_cancelled is True",
            cancelled_txn.get("is_cancelled") is True,
            f"got {cancelled_txn.get('is_cancelled')}",
        )
        check(
            "transaction.debit == 0",
            (cancelled_txn.get("debit") or 0) == 0,
            f"got {cancelled_txn.get('debit')}",
        )
        check(
            "transaction.deleted_at populated",
            bool(cancelled_txn.get("deleted_at")),
            f"got {cancelled_txn.get('deleted_at')}",
        )
        check(
            "transaction.deletion_reason == 'test cancel'",
            cancelled_txn.get("deletion_reason") == reason,
            f"got {cancelled_txn.get('deletion_reason')!r}",
        )

    # 6. Summary totals exclude the cancelled one
    total_purchases_after_summary = summary.get("total_purchases", 0)
    total_credit_given_after_summary = summary.get("total_credit_given", 0)
    check(
        "summary.total_purchases excludes cancelled (== 0 for this new vendor)",
        abs(total_purchases_after_summary - 0) < 1e-6,
        f"got {total_purchases_after_summary}",
    )
    check(
        "summary.total_credit_given excludes cancelled (== 0 for this new vendor)",
        abs(total_credit_given_after_summary - 0) < 1e-6,
        f"got {total_credit_given_after_summary}",
    )

    # 7. Verify vendor.outstanding_dues reversed (back to baseline)
    vendor_after = get_vendor(headers, vendor_id) or {}
    dues_after = vendor_after.get("outstanding_dues", 0)
    total_purchases_after = vendor_after.get("total_purchases", 0)
    txn_count_after = vendor_after.get("transaction_count", 0)
    check(
        "vendor.outstanding_dues reversed to baseline",
        abs(dues_after - dues_before) < 1e-6,
        f"{dues_mid} -> {dues_after} (baseline {dues_before})",
    )
    check(
        "vendor.total_purchases reversed to baseline",
        abs(total_purchases_after - total_purchases_before) < 1e-6,
        f"{total_purchases_mid} -> {total_purchases_after} (baseline {total_purchases_before})",
    )
    check(
        "vendor.transaction_count decremented",
        txn_count_after == txn_count_before,
        f"{txn_count_mid} -> {txn_count_after} (baseline {txn_count_before})",
    )

    # 8. Stock quantity reduced back to baseline
    stock_after = get_stock_qty(headers, outlet["id"], product["id"])
    check(
        "stock reversed at outlet (quantity -= qty)",
        abs(stock_after - stock_before) < 1e-6,
        f"{stock_mid} -> {stock_after} (baseline {stock_before})",
    )

    # 9. Extra: double-delete should be blocked
    r2 = requests.delete(
        f"{API}/vendor-procurement/{procurement_id}",
        headers=headers,
        params={"reason": "again"},
        timeout=30,
    )
    check(
        "double-delete blocked (4xx)",
        r2.status_code in (400, 404, 409),
        f"status={r2.status_code}",
    )

    print(f"\nDone. receipt_number={receipt_number}")
    return failures


if __name__ == "__main__":
    fails = main()
    print("\n=== SUMMARY ===")
    if not fails:
        print("ALL CHECKS PASSED")
    else:
        print(f"FAILED CHECKS ({len(fails)}):")
        for f in fails:
            print(f"  - {f}")
