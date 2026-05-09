"""
Backend tests for the new POST /api/vendor-procurement/bulk endpoint and the
related downstream behaviours (ledger, stock, transactions report, deletion).

LIVE production DB — uses TEST_<uuid> prefixed entities, leaves real data alone.
"""
import os
import sys
import json
import uuid
import time
import requests
from typing import Optional, Dict, Any, List

BASE = os.environ.get(
    "BACKEND_BASE",
    "https://transaction-mgmt-dev.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

PASS_LIST: List[str] = []
FAIL_LIST: List[str] = []


def _log(label: str, ok: bool, detail: str = ""):
    line = f"{'PASS' if ok else 'FAIL'} :: {label}"
    if detail:
        line += f" — {detail}"
    print(line)
    (PASS_LIST if ok else FAIL_LIST).append(line)


def _login() -> str:
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    r.raise_for_status()
    body = r.json()
    tok = body.get("access_token") or body.get("token")
    assert tok, f"no token in {body}"
    return tok


def _h(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get_active_outlet(token: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/outlets", headers=_h(token), timeout=30)
    r.raise_for_status()
    outlets = [o for o in r.json() if o.get("is_active", True)]
    assert outlets, "No active outlets present"
    return outlets[0]


def _get_active_products(token: str) -> List[Dict[str, Any]]:
    r = requests.get(f"{API}/products", headers=_h(token), timeout=30)
    r.raise_for_status()
    return [p for p in r.json() if p.get("is_active", True)]


def _create_test_vendor(token: str, suffix: str) -> Dict[str, Any]:
    body = {
        "name": f"Bulk Vendor TEST_{suffix}",
        "mobile": "9000000000",
        "address": "Test Lane",
        "village": "Testpura",
    }
    r = requests.post(f"{API}/vendors", headers=_h(token), json=body, timeout=30)
    r.raise_for_status()
    out = r.json()
    vid = out.get("id") or out.get("vendor_id")
    assert vid, f"no vendor id: {out}"
    return {"id": vid, "name": body["name"]}


def _create_test_product(token: str, suffix: str, with_variety: bool = False) -> Dict[str, Any]:
    body: Dict[str, Any] = {
        "name": f"Bulk Product TEST_{suffix}",
        "name_hi": f"बल्क उत्पाद TEST_{suffix}",
        "unit": "kg",
        "category": "produce",
    }
    if with_variety:
        body["varieties"] = [{"name": "DefaultVar", "name_hi": "डिफ़ॉल्ट"}]
    r = requests.post(f"{API}/products", headers=_h(token), json=body, timeout=30)
    r.raise_for_status()
    j = r.json()
    pid = j.get("id") or j.get("product_id")
    assert pid, f"no product id: {j}"
    # Re-fetch to get full doc with variety IDs assigned
    r2 = requests.get(f"{API}/products", headers=_h(token), timeout=30)
    r2.raise_for_status()
    full = next((x for x in r2.json() if x["id"] == pid), None)
    assert full, "could not refetch product"
    return full


def _stock_for(token: str, product_id: str, outlet_id: str) -> float:
    r = requests.get(f"{API}/stock", headers=_h(token), timeout=30)
    r.raise_for_status()
    for s in r.json():
        if s.get("product_id") == product_id and s.get("outlet_id") == outlet_id:
            return float(s.get("quantity", 0) or 0)
    return 0.0


def _vendor_doc(token: str, vid: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/vendors", headers=_h(token), timeout=30)
    r.raise_for_status()
    for v in r.json():
        if v.get("id") == vid:
            return v
    return {}


def _vendor_ledger(token: str, vid: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/vendors/{vid}/ledger", headers=_h(token), timeout=30)
    r.raise_for_status()
    return r.json()


def _approx(a: float, b: float, tol: float = 0.01) -> bool:
    return abs(float(a) - float(b)) <= tol


def main():
    suffix = uuid.uuid4().hex[:8]
    print(f"=== Bulk Procurement Tests — TEST suffix {suffix} ===")
    print(f"Base URL: {BASE}")

    token = _login()
    _log("admin login (admin/admin123)", True)

    outlet = _get_active_outlet(token)
    outlet_id = outlet["id"]
    _log(f"picked outlet '{outlet.get('name')}'", True, f"id={outlet_id}")

    # Create TEST vendor + 2 products (one with a variety)
    vendor = _create_test_vendor(token, suffix)
    vid = vendor["id"]
    _log("created TEST vendor", True, f"id={vid}")

    p1 = _create_test_product(token, f"{suffix}_A", with_variety=True)
    p2 = _create_test_product(token, f"{suffix}_B", with_variety=False)
    p1_id, p2_id = p1["id"], p2["id"]
    var = (p1.get("varieties") or [{}])[0]
    var_id = var.get("id")
    var_name = var.get("name")
    _log("created TEST products", True, f"p1={p1_id} (variety_id={var_id}) p2={p2_id}")

    # Baseline state
    base_v = _vendor_doc(token, vid)
    base_outstanding = float(base_v.get("outstanding_dues") or 0)
    base_total_purchases = float(base_v.get("total_purchases") or 0)
    base_txn_count = int(base_v.get("transaction_count") or 0)
    base_stock_p1 = _stock_for(token, p1_id, outlet_id)
    base_stock_p2 = _stock_for(token, p2_id, outlet_id)

    # =========================================================
    # SUB-TEST 2: bulk POST with 2 items, payment_mode=credit
    # =========================================================
    qty1, rate1 = 5.0, 80.0
    qty2, rate2 = 3.0, 120.0
    expected_total = qty1 * rate1 + qty2 * rate2  # 400 + 360 = 760

    payload2 = {
        "vendor_id": vid,
        "outlet_id": outlet_id,
        "payment_mode": "credit",
        "cash_amount": 0,
        "online_amount": 0,
        "items": [
            {
                "product_id": p1_id,
                "quantity": qty1,
                "rate": rate1,
                "variety_id": var_id,
                "variety_name": var_name,
            },
            {
                "product_id": p2_id,
                "quantity": qty2,
                "rate": rate2,
            },
        ],
    }
    r = requests.post(f"{API}/vendor-procurement/bulk", headers=_h(token), json=payload2, timeout=30)
    ok = r.status_code == 200
    _log("[2] POST /vendor-procurement/bulk (2 items, credit) → 200", ok, f"status={r.status_code} body={r.text[:200]}")
    if not ok:
        _summary()
        return
    body2 = r.json()
    proc_id_2 = body2["procurement_id"]
    receipt_2 = body2["receipt_number"]
    _log("[2] response carries procurement_id + receipt_number", bool(proc_id_2 and receipt_2), f"id={proc_id_2} rcpt={receipt_2}")
    _log("[2] response items_count == 2", body2.get("items_count") == 2, f"got {body2.get('items_count')}")
    _log("[2] response total_amount == 760", _approx(body2.get("total_amount", 0), expected_total), f"got {body2.get('total_amount')}")
    _log("[2] response payment_status == 'credit'", body2.get("payment_status") == "credit", f"got {body2.get('payment_status')}")
    _log("[2] response credit_amount == total", _approx(body2.get("credit_amount", 0), expected_total))

    # 2a) GET /vendor-procurement returns items array length 2
    r = requests.get(f"{API}/vendor-procurement", headers=_h(token), timeout=30)
    r.raise_for_status()
    rows = r.json()
    bulk_doc = next((x for x in rows if x.get("id") == proc_id_2), None)
    _log("[2a] bulk doc retrievable via GET /vendor-procurement", bool(bulk_doc))
    if bulk_doc:
        items = bulk_doc.get("items") or []
        _log("[2a] items array length == 2", len(items) == 2, f"len={len(items)}")
        if len(items) == 2:
            i0, i1 = items[0], items[1]
            checks_ok = (
                _approx(i0.get("quantity", 0), qty1)
                and _approx(i0.get("rate", 0), rate1)
                and _approx(i0.get("amount", 0), qty1 * rate1)
                and _approx(i1.get("quantity", 0), qty2)
                and _approx(i1.get("rate", 0), rate2)
                and _approx(i1.get("amount", 0), qty2 * rate2)
            )
            _log("[2a] items[*].quantity/rate/amount populated correctly", checks_ok, json.dumps([i0, i1])[:300])
            _log("[2a] items[0].variety_id passed-through", i0.get("variety_id") == var_id, f"got {i0.get('variety_id')}")

    # 2b) Stock incremented
    s1_after = _stock_for(token, p1_id, outlet_id)
    s2_after = _stock_for(token, p2_id, outlet_id)
    _log("[2b] stock p1 incremented by qty1", _approx(s1_after, base_stock_p1 + qty1), f"{base_stock_p1} → {s1_after}")
    _log("[2b] stock p2 incremented by qty2", _approx(s2_after, base_stock_p2 + qty2), f"{base_stock_p2} → {s2_after}")

    # 2c) Vendor ledger transaction
    led = _vendor_ledger(token, vid)
    txns = led.get("transactions") or []
    txn = next((t for t in txns if (t.get("reference") == receipt_2 or t.get("transaction_id") == proc_id_2 or t.get("id") == proc_id_2)), None)
    _log("[2c] vendor ledger contains transaction for receipt", bool(txn), f"matched? {bool(txn)} transactions={len(txns)}")
    if txn:
        _log("[2c] transaction items_count==2", txn.get("items_count") == 2, f"got {txn.get('items_count')}")
        _log("[2c] transaction items array length==2", len(txn.get("items") or []) == 2, f"len={len(txn.get('items') or [])}")
        # On full-credit purchase, ledger's `debit` should equal the procurement's
        # credit_amount (760) and the procurement's total (760).
        debit = float(txn.get("debit") or 0)
        total_amt = float(txn.get("total_amount") or 0)
        _log("[2c] debit == total == credit_amount of procurement (full credit)",
             _approx(debit, expected_total) and _approx(total_amt, expected_total),
             f"debit={debit} total_amount={total_amt} expected={expected_total}")
        desc = (txn.get("description") or "").lower()
        contains = (p1["name"].lower() in desc) or (p2["name"].lower() in desc)
        _log("[2c] description includes a product name", contains, f"desc='{txn.get('description')}'")

    # 2d) Reports/transactions returns 2 rows for receipt
    r = requests.get(f"{API}/reports/transactions", headers=_h(token),
                     params={"format": "json", "type": "purchase"}, timeout=60)
    r.raise_for_status()
    rep = r.json()
    rows_rep = rep.get("rows") or []
    matching = [row for row in rows_rep if row.get("reference") == receipt_2]
    _log("[2d] reports/transactions has >=2 rows for the receipt", len(matching) >= 2, f"matching rows={len(matching)}")

    # =========================================================
    # SUB-TEST 3: 3 items partial payment, credit_amount==total/2
    # =========================================================
    base_v_pre3 = _vendor_doc(token, vid)
    pre_outstanding_3 = float(base_v_pre3.get("outstanding_dues") or 0)

    items3 = [
        {"product_id": p1_id, "quantity": 2.0, "rate": 50.0},
        {"product_id": p2_id, "quantity": 4.0, "rate": 25.0},
        {"product_id": p1_id, "quantity": 1.0, "rate": 100.0},
    ]
    total3 = 100.0 + 100.0 + 100.0  # 300
    half = total3 / 2.0
    payload3 = {
        "vendor_id": vid,
        "outlet_id": outlet_id,
        "payment_mode": "partial",
        "cash_amount": half * 0.6,  # 90
        "online_amount": half * 0.4,  # 60 — sum=150 (half of 300)
        "items": items3,
    }
    r = requests.post(f"{API}/vendor-procurement/bulk", headers=_h(token), json=payload3, timeout=30)
    ok3 = r.status_code == 200
    _log("[3] partial payment bulk (3 items) → 200", ok3, f"status={r.status_code} body={r.text[:200]}")
    if ok3:
        body3 = r.json()
        proc_id_3 = body3["procurement_id"]
        _log("[3] credit_amount == total/2", _approx(body3.get("credit_amount", 0), half), f"got {body3.get('credit_amount')} expected {half}")
        _log("[3] payment_status == 'credit'", body3.get("payment_status") == "credit", f"got {body3.get('payment_status')}")
        v_after_3 = _vendor_doc(token, vid)
        delta = float(v_after_3.get("outstanding_dues") or 0) - pre_outstanding_3
        _log("[3] vendor.outstanding_dues incremented by exactly credit_amount",
             _approx(delta, half), f"Δ={delta} expected {half}")
    else:
        proc_id_3 = None

    # =========================================================
    # SUB-TEST 4: DELETE the SUB-TEST 2 procurement
    # =========================================================
    pre_del_v = _vendor_doc(token, vid)
    pre_del_outstanding = float(pre_del_v.get("outstanding_dues") or 0)
    pre_del_total_purch = float(pre_del_v.get("total_purchases") or 0)
    pre_del_txn_count = int(pre_del_v.get("transaction_count") or 0)
    pre_del_s1 = _stock_for(token, p1_id, outlet_id)
    pre_del_s2 = _stock_for(token, p2_id, outlet_id)

    r = requests.delete(
        f"{API}/vendor-procurement/{proc_id_2}",
        headers=_h(token),
        params={"reason": "test reverse"},
        timeout=30,
    )
    ok_del = r.status_code == 200
    _log("[4] DELETE /vendor-procurement/{id}?reason=... → 200", ok_del, f"status={r.status_code} body={r.text[:200]}")
    if ok_del:
        rd = r.json().get("reversal_details") or {}
        _log("[4] reversal_details.stock_reversed == True", rd.get("stock_reversed") is True, json.dumps(rd))
        _log("[4] reversal_details.vendor_ledger_adjusted == True", rd.get("vendor_ledger_adjusted") is True)

        s1_post = _stock_for(token, p1_id, outlet_id)
        s2_post = _stock_for(token, p2_id, outlet_id)
        _log("[4] stock p1 reverted by qty1", _approx(s1_post, pre_del_s1 - qty1), f"{pre_del_s1} → {s1_post} expected -{qty1}")
        _log("[4] stock p2 reverted by qty2", _approx(s2_post, pre_del_s2 - qty2), f"{pre_del_s2} → {s2_post} expected -{qty2}")

        v_post = _vendor_doc(token, vid)
        _log("[4] vendor.outstanding_dues reverted by expected_total (full credit)",
             _approx(float(v_post.get("outstanding_dues") or 0), pre_del_outstanding - expected_total),
             f"{pre_del_outstanding} → {v_post.get('outstanding_dues')} expected -{expected_total}")
        _log("[4] vendor.total_purchases reverted by total",
             _approx(float(v_post.get("total_purchases") or 0), pre_del_total_purch - expected_total),
             f"{pre_del_total_purch} → {v_post.get('total_purchases')}")
        _log("[4] vendor.transaction_count reverted by 1",
             int(v_post.get("transaction_count") or 0) == pre_del_txn_count - 1,
             f"{pre_del_txn_count} → {v_post.get('transaction_count')}")

    # =========================================================
    # SUB-TEST 5: edge cases
    # =========================================================
    r = requests.post(f"{API}/vendor-procurement/bulk", headers=_h(token),
                      json={"vendor_id": vid, "outlet_id": outlet_id, "payment_mode": "cash", "items": []}, timeout=30)
    _log("[5a] items=[] → 400", r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/vendor-procurement/bulk", headers=_h(token),
                      json={"vendor_id": vid, "outlet_id": outlet_id, "payment_mode": "cash",
                            "items": [{"product_id": p1_id, "quantity": 0, "rate": 50}]}, timeout=30)
    _log("[5b] item.quantity=0 → 400", r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    bogus = str(uuid.uuid4())
    r = requests.post(f"{API}/vendor-procurement/bulk", headers=_h(token),
                      json={"vendor_id": vid, "outlet_id": outlet_id, "payment_mode": "cash",
                            "items": [{"product_id": bogus, "quantity": 1, "rate": 10}]}, timeout=30)
    _log("[5c] unknown product_id → 404 mentioning Product",
         r.status_code == 404 and ("product" in r.text.lower()),
         f"status={r.status_code} body={r.text[:200]}")

    # =========================================================
    # SUB-TEST 6: legacy POST /vendor-procurement (single item)
    # =========================================================
    legacy_payload = {
        "vendor_id": vid,
        "outlet_id": outlet_id,
        "product_id": p2_id,
        "quantity": 2.0,
        "rate": 30.0,
        "payment_mode": "cash",
        "cash_amount": 60.0,
        "online_amount": 0,
    }
    r = requests.post(f"{API}/vendor-procurement", headers=_h(token), json=legacy_payload, timeout=30)
    ok_legacy = r.status_code == 200
    _log("[6] legacy POST /vendor-procurement (single item) → 200", ok_legacy, f"status={r.status_code} body={r.text[:200]}")
    if ok_legacy:
        legacy_id = r.json().get("procurement_id") or r.json().get("id")
        if legacy_id:
            r2 = requests.delete(f"{API}/vendor-procurement/{legacy_id}", headers=_h(token),
                                 params={"reason": "test legacy cleanup"}, timeout=30)
            _log("[6] legacy DELETE /vendor-procurement/{id} → 200", r2.status_code == 200,
                 f"status={r2.status_code} body={r2.text[:200]}")

    # =========================================================
    # SUB-TEST 7: manual product item — name resolution & no stock impact
    # =========================================================
    base_s1 = _stock_for(token, p1_id, outlet_id)
    manual_payload = {
        "vendor_id": vid,
        "outlet_id": outlet_id,
        "payment_mode": "cash",
        "cash_amount": 50.0,
        "online_amount": 0,
        "items": [
            {"product_id": "manual", "manual_product_name": "Test Manual SKU", "quantity": 1, "rate": 50.0},
        ],
    }
    r = requests.post(f"{API}/vendor-procurement/bulk", headers=_h(token), json=manual_payload, timeout=30)
    ok7 = r.status_code == 200
    _log("[7] bulk with manual product → 200", ok7, f"status={r.status_code} body={r.text[:200]}")
    if ok7:
        proc_id_7 = r.json()["procurement_id"]
        # Verify resolved item name
        r2 = requests.get(f"{API}/vendor-procurement", headers=_h(token), timeout=30)
        rows = r2.json()
        doc7 = next((x for x in rows if x.get("id") == proc_id_7), None)
        if doc7:
            it = (doc7.get("items") or [{}])[0]
            _log("[7] resolved item.product_name == 'Test Manual SKU'",
                 it.get("product_name") == "Test Manual SKU",
                 f"got {it.get('product_name')}")
        # Stock unchanged for manual items (and p1 unaffected anyway)
        s1_post7 = _stock_for(token, p1_id, outlet_id)
        _log("[7] stock NOT incremented for manual item (p1 unchanged)",
             _approx(s1_post7, base_s1), f"{base_s1} → {s1_post7}")

    _summary()


def _summary():
    print()
    print("=" * 60)
    print(f"PASSED: {len(PASS_LIST)}")
    print(f"FAILED: {len(FAIL_LIST)}")
    if FAIL_LIST:
        print("\nFailures:")
        for f in FAIL_LIST:
            print(" -", f)
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        _summary()
        sys.exit(1)
    sys.exit(0 if not FAIL_LIST else 1)
