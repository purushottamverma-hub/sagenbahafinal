"""
Backend test for the two new admin-only EDIT endpoints:
  PUT /api/sales/{sale_id}
  PUT /api/vendor-procurement/{procurement_id}

Strategy:
- Use TEST_<uuid> prefixed entities only.
- Soft-delete TEST entities at the end, never touch live data.
- Capture baselines AFTER the seed step for both customer and vendor totals.
"""

import os
import sys
import uuid
import json
import requests
from typing import Any, Dict, List, Optional


# -------------------- Config --------------------
def _read_backend_url() -> str:
    env_path = "/app/frontend/.env"
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL missing in /app/frontend/.env")


BASE = _read_backend_url().rstrip("/")
API = f"{BASE}/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

results: List[Dict[str, Any]] = []
failures: List[str] = []


def _record(name: str, ok: bool, info: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    line = f"[{status}] {name}" + (f" — {info}" if info else "")
    print(line, flush=True)
    results.append({"name": name, "ok": ok, "info": info})
    if not ok:
        failures.append(line)
    return ok


def _assert(cond: bool, name: str, info: str = "") -> bool:
    return _record(name, bool(cond), info)


def _approx_equal(a: float, b: float, tol: float = 0.001) -> bool:
    try:
        return abs(float(a) - float(b)) <= tol
    except Exception:
        return False


# -------------------- HTTP helpers --------------------
def _login(username: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"username": username, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _hdr(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------------------- Helpers to fetch state --------------------
def get_customer(token: str, cid: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/customers/{cid}", headers=_hdr(token), timeout=30)
    r.raise_for_status()
    return r.json()


def get_vendor(token: str, vid: str) -> Dict[str, Any]:
    r = requests.get(f"{API}/vendors/{vid}", headers=_hdr(token), timeout=30)
    r.raise_for_status()
    return r.json()


def get_stock_qty(token: str, product_id: str, outlet_id: str) -> float:
    r = requests.get(
        f"{API}/stock",
        headers=_hdr(token),
        params={"outlet_id": outlet_id},
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json()
    for s in rows:
        if s.get("product_id") == product_id and s.get("outlet_id") == outlet_id:
            return float(s.get("quantity") or 0)
    return 0.0


# -------------------- Main test --------------------
def main() -> int:
    print(f"Backend base: {BASE}")
    token = _login(ADMIN_USER, ADMIN_PASS)
    _record("Admin login", bool(token))
    H = _hdr(token)

    tag = f"TEST_{uuid.uuid4().hex[:10]}"
    created = {
        "customer": None,
        "vendor": None,
        "products": [],
        "sale": None,
        "procurement": None,
    }

    try:
        # =============== 1) SETUP ===============
        # Customer
        cust_payload = {
            "name": f"Ramesh Kumar {tag}",
            "mobile": "9876512345",
            "village": "Test Village",
            "address": "Test Address",
            "customer_type": "registered",
        }
        r = requests.post(f"{API}/customers", headers=H, json=cust_payload, timeout=30)
        _assert(r.status_code == 200, "Create TEST customer", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        customer = r.json()
        created["customer"] = customer["id"]

        # Vendor
        vend_payload = {
            "name": f"Sharma Traders {tag}",
            "mobile": "9112345678",
            "village": "Vendor Village",
            "address": "Vendor Addr",
        }
        r = requests.post(f"{API}/vendors", headers=H, json=vend_payload, timeout=30)
        _assert(r.status_code == 200, "Create TEST vendor", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        vendor = r.json()
        created["vendor"] = vendor["id"]

        # Two active products
        for label, name in [("A", f"Wheat {tag}_A"), ("B", f"Rice {tag}_B")]:
            r = requests.post(
                f"{API}/products",
                headers=H,
                json={"name": name, "unit": "kg", "category": "produce", "is_active": True},
                timeout=30,
            )
            _assert(r.status_code == 200, f"Create TEST product {label}", f"HTTP {r.status_code} {r.text[:200]}")
            if r.status_code != 200:
                return 1
            created["products"].append(r.json())

        p1 = created["products"][0]
        p2 = created["products"][1]

        # Pick non-central active outlet
        r = requests.get(f"{API}/outlets", headers=H, timeout=30)
        r.raise_for_status()
        outlets = r.json()
        non_central = [o for o in outlets if not o.get("is_central") and o.get("is_active", True)]
        _assert(len(non_central) > 0, "Locate non-central active outlet", f"found {len(non_central)}")
        if not non_central:
            return 1
        outlet = non_central[0]
        outlet_id = outlet["id"]

        # Seed stock via bulk procurement (50 of each)
        bulk_seed = {
            "vendor_id": vendor["id"],
            "outlet_id": outlet_id,
            "items": [
                {"product_id": p1["id"], "quantity": 50, "rate": 10},
                {"product_id": p2["id"], "quantity": 50, "rate": 20},
            ],
            "payment_mode": "cash",
            "cash_amount": 50 * 10 + 50 * 20,
            "online_amount": 0,
        }
        r = requests.post(f"{API}/vendor-procurement/bulk", headers=H, json=bulk_seed, timeout=60)
        _assert(r.status_code == 200, "Seed stock via bulk procurement", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        seed_proc = r.json()
        seed_proc_id = seed_proc.get("procurement_id")

        # Capture BASELINES (post-seed) for customer and vendor and stock
        customer = get_customer(token, created["customer"])
        vendor = get_vendor(token, created["vendor"])
        base_cust = {
            "outstanding_balance": float(customer.get("outstanding_balance") or 0),
            "total_paid": float(customer.get("total_paid") or 0),
            "total_purchases": float(customer.get("total_purchases") or 0),
            "total_credit": float(customer.get("total_credit") or 0),
            "transaction_count": int(customer.get("transaction_count") or 0),
        }
        base_vend = {
            "outstanding_dues": float(vendor.get("outstanding_dues") or 0),
            "total_purchases": float(vendor.get("total_purchases") or 0),
            "total_paid": float(vendor.get("total_paid") or 0),
            "transaction_count": int(vendor.get("transaction_count") or 0),
        }
        base_p1_stock = get_stock_qty(token, p1["id"], outlet_id)
        base_p2_stock = get_stock_qty(token, p2["id"], outlet_id)
        _assert(base_p1_stock >= 50, "Baseline P1 stock seeded", f"qty={base_p1_stock}")
        _assert(base_p2_stock >= 50, "Baseline P2 stock seeded", f"qty={base_p2_stock}")
        print(f"BASELINES: cust={base_cust} vend={base_vend} p1_stock={base_p1_stock} p2_stock={base_p2_stock}")

        # =============== 2) PUT /api/sales/{sale_id} ===============
        # 2a. Create credit sale qty=2 rate=100 total=200
        sale_body = {
            "outlet_id": outlet_id,
            "customer_id": created["customer"],
            "customer_name": customer["name"],
            "items": [{
                "product_id": p1["id"],
                "product_name": p1["name"],
                "quantity": 2,
                "rate": 100,
                "amount": 200,
            }],
            "subtotal": 200,
            "discount": 0,
            "total_amount": 200,
            "payment_mode": "credit",
            "cash_amount": 0,
            "online_amount": 0,
            "credit_amount": 200,
        }
        r = requests.post(f"{API}/sales", headers=H, json=sale_body, timeout=30)
        _assert(r.status_code == 200, "2a) POST /api/sales (credit 200)", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        sale_resp = r.json()
        sale_id = sale_resp.get("id") or sale_resp.get("sale_id")
        if not sale_id and isinstance(sale_resp, dict):
            sale_id = sale_resp.get("sale", {}).get("id")
        _assert(bool(sale_id), "2a) Capture sale_id", f"got {sale_id}")
        created["sale"] = sale_id

        # 2b. Verify customer outstanding balance increased by 200 vs baseline; stock for P1 -=2
        customer = get_customer(token, created["customer"])
        p1_stock = get_stock_qty(token, p1["id"], outlet_id)
        _assert(
            _approx_equal(customer["outstanding_balance"], base_cust["outstanding_balance"] + 200),
            "2b) outstanding_balance += 200",
            f"got={customer['outstanding_balance']} expected={base_cust['outstanding_balance'] + 200}",
        )
        _assert(
            _approx_equal(p1_stock, base_p1_stock - 2),
            "2b) P1 stock -= 2",
            f"got={p1_stock} expected={base_p1_stock - 2}",
        )

        # 2c. PUT same items but qty=5 total=500 credit=500
        edit_body = {
            "outlet_id": outlet_id,
            "customer_id": created["customer"],
            "customer_name": customer["name"],
            "items": [{
                "product_id": p1["id"],
                "product_name": p1["name"],
                "quantity": 5,
                "rate": 100,
                "amount": 500,
            }],
            "subtotal": 500,
            "discount": 0,
            "total_amount": 500,
            "payment_mode": "credit",
            "cash_amount": 0,
            "online_amount": 0,
            "credit_amount": 500,
        }
        r = requests.put(
            f"{API}/sales/{sale_id}",
            headers=H,
            params={"reason": "qty correction"},
            json=edit_body,
            timeout=30,
        )
        _assert(r.status_code == 200, "2c) PUT /api/sales (qty 2->5)", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        edit_resp = r.json()
        sale_after = edit_resp.get("sale") or {}
        _assert(sale_after.get("is_edited") is True, "2c) sale.is_edited == true", f"got={sale_after.get('is_edited')}")
        eh = sale_after.get("edit_history") or []
        _assert(len(eh) == 1, "2c) edit_history length == 1", f"got={len(eh)}")

        # 2d. Verify customer.outstanding_balance == baseline + 500; stock for P1 == baseline - 5
        customer = get_customer(token, created["customer"])
        p1_stock = get_stock_qty(token, p1["id"], outlet_id)
        _assert(
            _approx_equal(customer["outstanding_balance"], base_cust["outstanding_balance"] + 500),
            "2d) outstanding_balance == baseline + 500",
            f"got={customer['outstanding_balance']}",
        )
        _assert(
            _approx_equal(p1_stock, base_p1_stock - 5),
            "2d) P1 stock == baseline - 5",
            f"got={p1_stock} expected={base_p1_stock - 5}",
        )

        # 2e. PUT again with payment_mode='cash', cash_amount=500, credit_amount=0
        edit_body2 = dict(edit_body)
        edit_body2["payment_mode"] = "cash"
        edit_body2["cash_amount"] = 500
        edit_body2["online_amount"] = 0
        edit_body2["credit_amount"] = 0
        r = requests.put(
            f"{API}/sales/{sale_id}",
            headers=H,
            params={"reason": "switch to cash"},
            json=edit_body2,
            timeout=30,
        )
        _assert(r.status_code == 200, "2e) PUT /api/sales (credit -> cash)", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        edit_resp = r.json()
        sale_after = edit_resp.get("sale") or {}
        eh = sale_after.get("edit_history") or []
        _assert(len(eh) == 2, "2e) edit_history length == 2", f"got={len(eh)}")

        customer = get_customer(token, created["customer"])
        _assert(
            _approx_equal(customer["outstanding_balance"], base_cust["outstanding_balance"]),
            "2e) outstanding_balance back to baseline",
            f"got={customer['outstanding_balance']} baseline={base_cust['outstanding_balance']}",
        )
        _assert(
            _approx_equal(customer["total_paid"], base_cust["total_paid"] + 500),
            "2e) total_paid == baseline + 500",
            f"got={customer['total_paid']} baseline+500={base_cust['total_paid'] + 500}",
        )

        # 2f. Insufficient stock rollback: PUT with quantity=999999
        # Snapshot doc + customer + stock BEFORE this attempt
        pre_stock = get_stock_qty(token, p1["id"], outlet_id)
        pre_customer = get_customer(token, created["customer"])
        # Get current sale doc to compare fields after the failed PUT
        r = requests.get(f"{API}/sales/{sale_id}", headers=H, timeout=30)
        _assert(r.status_code == 200, "2f) Snapshot sale doc before insufficient PUT", f"HTTP {r.status_code}")
        pre_sale_doc = r.json() if r.status_code == 200 else {}

        bad_body = dict(edit_body2)
        bad_body["items"] = [{
            "product_id": p1["id"],
            "product_name": p1["name"],
            "quantity": 999999,
            "rate": 100,
            "amount": 99999900,
        }]
        bad_body["subtotal"] = 99999900
        bad_body["total_amount"] = 99999900
        bad_body["cash_amount"] = 99999900
        r = requests.put(
            f"{API}/sales/{sale_id}",
            headers=H,
            params={"reason": "bad qty"},
            json=bad_body,
            timeout=30,
        )
        _assert(r.status_code == 400, "2f) PUT 999999 -> 400 Insufficient stock", f"HTTP {r.status_code} {r.text[:200]}")
        body_lower = (r.text or "").lower()
        _assert("insufficient stock" in body_lower, "2f) error message mentions Insufficient stock")

        # Verify sale doc, customer, stock unchanged
        r = requests.get(f"{API}/sales/{sale_id}", headers=H, timeout=30)
        _assert(r.status_code == 200, "2f) GET sale doc after rollback", f"HTTP {r.status_code}")
        post_sale_doc = r.json() if r.status_code == 200 else {}
        _assert(
            post_sale_doc.get("total_amount") == pre_sale_doc.get("total_amount")
            and post_sale_doc.get("payment_mode") == pre_sale_doc.get("payment_mode")
            and post_sale_doc.get("cash_amount") == pre_sale_doc.get("cash_amount")
            and post_sale_doc.get("credit_amount") == pre_sale_doc.get("credit_amount")
            and len(post_sale_doc.get("edit_history") or []) == len(pre_sale_doc.get("edit_history") or []),
            "2f) sale doc unchanged after rollback",
            f"pre.total={pre_sale_doc.get('total_amount')} post.total={post_sale_doc.get('total_amount')}; pre.eh={len(pre_sale_doc.get('edit_history') or [])} post.eh={len(post_sale_doc.get('edit_history') or [])}",
        )
        post_customer = get_customer(token, created["customer"])
        _assert(
            _approx_equal(post_customer["outstanding_balance"], pre_customer["outstanding_balance"])
            and _approx_equal(post_customer["total_paid"], pre_customer["total_paid"])
            and _approx_equal(post_customer["total_purchases"], pre_customer["total_purchases"])
            and post_customer["transaction_count"] == pre_customer["transaction_count"],
            "2f) customer ledger unchanged after rollback",
            f"pre={pre_customer.get('outstanding_balance'),pre_customer.get('total_paid'),pre_customer.get('total_purchases'),pre_customer.get('transaction_count')} post={post_customer.get('outstanding_balance'),post_customer.get('total_paid'),post_customer.get('total_purchases'),post_customer.get('transaction_count')}",
        )
        post_stock = get_stock_qty(token, p1["id"], outlet_id)
        _assert(_approx_equal(post_stock, pre_stock), "2f) stock unchanged after rollback", f"pre={pre_stock} post={post_stock}")

        # 2g. Negative paths
        bogus_id = f"nonexistent-{uuid.uuid4().hex}"
        r = requests.put(
            f"{API}/sales/{bogus_id}",
            headers=H,
            params={"reason": "test"},
            json=edit_body2,
            timeout=30,
        )
        _assert(r.status_code == 404, "2g) PUT non-existent sale -> 404", f"HTTP {r.status_code} {r.text[:200]}")

        # Soft-delete current sale and try PUT -> expect 400 with deleted/cancelled
        r = requests.delete(
            f"{API}/sales/{sale_id}",
            headers=H,
            params={"reason": "negative path test"},
            timeout=30,
        )
        _assert(r.status_code == 200, "2g) DELETE sale (soft) before negative test", f"HTTP {r.status_code} {r.text[:200]}")

        r = requests.put(
            f"{API}/sales/{sale_id}",
            headers=H,
            params={"reason": "edit deleted"},
            json=edit_body2,
            timeout=30,
        )
        _assert(r.status_code == 400, "2g) PUT deleted sale -> 400", f"HTTP {r.status_code} {r.text[:200]}")
        msg = (r.text or "").lower()
        _assert(
            ("deleted" in msg) or ("cancelled" in msg) or ("canceled" in msg),
            "2g) error mentions deleted/cancelled",
            f"body={r.text[:200]}",
        )

        # =============== 3) PUT /api/vendor-procurement/{procurement_id} ===============
        # Capture vendor baseline NOW (right before the procurement-edit flow) so deltas are clean
        vendor = get_vendor(token, created["vendor"])
        v_base = {
            "outstanding_dues": float(vendor.get("outstanding_dues") or 0),
            "total_purchases": float(vendor.get("total_purchases") or 0),
            "total_paid": float(vendor.get("total_paid") or 0),
            "transaction_count": int(vendor.get("transaction_count") or 0),
        }
        p1_stock_v_base = get_stock_qty(token, p1["id"], outlet_id)
        p2_stock_v_base = get_stock_qty(token, p2["id"], outlet_id)

        # 3a. POST bulk credit procurement: P1 qty=10 rate=50, P2 qty=5 rate=80, payment_mode=credit
        bulk_body = {
            "vendor_id": created["vendor"],
            "outlet_id": outlet_id,
            "items": [
                {"product_id": p1["id"], "quantity": 10, "rate": 50},
                {"product_id": p2["id"], "quantity": 5, "rate": 80},
            ],
            "payment_mode": "credit",
            "cash_amount": 0,
            "online_amount": 0,
        }
        r = requests.post(f"{API}/vendor-procurement/bulk", headers=H, json=bulk_body, timeout=30)
        _assert(r.status_code == 200, "3a) POST /api/vendor-procurement/bulk (credit)", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        proc_resp = r.json()
        procurement_id = proc_resp.get("procurement_id") or proc_resp.get("id")
        proc_total = float(proc_resp.get("total_amount") or (10 * 50 + 5 * 80))
        _assert(bool(procurement_id), "3a) Capture procurement_id", f"got={procurement_id}")
        _assert(_approx_equal(proc_total, 900), "3a) total_amount == 900", f"got={proc_total}")
        created["procurement"] = procurement_id

        # 3b. Verify stock and vendor ledger deltas vs baseline
        p1_stock_after_a = get_stock_qty(token, p1["id"], outlet_id)
        p2_stock_after_a = get_stock_qty(token, p2["id"], outlet_id)
        _assert(_approx_equal(p1_stock_after_a, p1_stock_v_base + 10), "3b) P1 stock += 10",
                f"got={p1_stock_after_a} expected={p1_stock_v_base + 10}")
        _assert(_approx_equal(p2_stock_after_a, p2_stock_v_base + 5), "3b) P2 stock += 5",
                f"got={p2_stock_after_a} expected={p2_stock_v_base + 5}")

        vendor = get_vendor(token, created["vendor"])
        _assert(_approx_equal(vendor["outstanding_dues"], v_base["outstanding_dues"] + proc_total),
                "3b) vendor.outstanding_dues += total",
                f"got={vendor['outstanding_dues']} expected={v_base['outstanding_dues'] + proc_total}")
        _assert(_approx_equal(vendor["total_purchases"], v_base["total_purchases"] + proc_total),
                "3b) vendor.total_purchases += total",
                f"got={vendor['total_purchases']} expected={v_base['total_purchases'] + proc_total}")

        # 3c. PUT to swap items: only P1 qty=2 rate=200, payment cash 400
        swap_body = {
            "vendor_id": created["vendor"],
            "outlet_id": outlet_id,
            "items": [
                {"product_id": p1["id"], "quantity": 2, "rate": 200},
            ],
            "payment_mode": "cash",
            "cash_amount": 400,
            "online_amount": 0,
        }
        r = requests.put(
            f"{API}/vendor-procurement/{procurement_id}",
            headers=H,
            params={"reason": "swap"},
            json=swap_body,
            timeout=30,
        )
        _assert(r.status_code == 200, "3c) PUT /api/vendor-procurement (swap)", f"HTTP {r.status_code} {r.text[:200]}")
        if r.status_code != 200:
            return 1
        swap_resp = r.json()
        _assert(swap_resp.get("items_count") == 1, "3c) items_count == 1", f"got={swap_resp.get('items_count')}")
        _assert(swap_resp.get("payment_status") == "paid", "3c) payment_status == 'paid'", f"got={swap_resp.get('payment_status')}")
        _assert(_approx_equal(swap_resp.get("credit_amount") or 0, 0), "3c) credit_amount == 0", f"got={swap_resp.get('credit_amount')}")
        _assert(_approx_equal(swap_resp.get("total_amount") or 0, 400), "3c) total_amount == 400", f"got={swap_resp.get('total_amount')}")

        # 3d. Verify net stock effect vs baseline
        p1_stock_after_c = get_stock_qty(token, p1["id"], outlet_id)
        p2_stock_after_c = get_stock_qty(token, p2["id"], outlet_id)
        _assert(_approx_equal(p1_stock_after_c, p1_stock_v_base + 2),
                "3d) P1 net stock vs baseline = +2",
                f"got={p1_stock_after_c} expected={p1_stock_v_base + 2}")
        _assert(_approx_equal(p2_stock_after_c, p2_stock_v_base),
                "3d) P2 net stock vs baseline = 0",
                f"got={p2_stock_after_c} expected={p2_stock_v_base}")

        # 3e. Vendor ledger: outstanding_dues == baseline; total_purchases delta = +400; transaction_count delta = +1
        vendor = get_vendor(token, created["vendor"])
        _assert(_approx_equal(vendor["outstanding_dues"], v_base["outstanding_dues"]),
                "3e) vendor.outstanding_dues back to baseline",
                f"got={vendor['outstanding_dues']} baseline={v_base['outstanding_dues']}")
        _assert(_approx_equal(vendor["total_purchases"], v_base["total_purchases"] + 400),
                "3e) vendor.total_purchases delta = +400",
                f"got={vendor['total_purchases']} baseline+400={v_base['total_purchases'] + 400}")
        _assert(int(vendor.get("transaction_count") or 0) == v_base["transaction_count"] + 1,
                "3e) vendor.transaction_count delta = +1",
                f"got={vendor.get('transaction_count')} baseline+1={v_base['transaction_count'] + 1}")

        # 3f. edit_history length == 1, is_edited == true, items_count == 1 (fetch doc)
        r = requests.get(f"{API}/vendor-procurement/{procurement_id}", headers=H, timeout=30)
        _assert(r.status_code == 200, "3f) GET procurement doc", f"HTTP {r.status_code}")
        proc_doc = r.json() if r.status_code == 200 else {}
        _assert(proc_doc.get("is_edited") is True, "3f) procurement.is_edited == true",
                f"got={proc_doc.get('is_edited')}")
        eh = proc_doc.get("edit_history") or []
        _assert(len(eh) == 1, "3f) procurement.edit_history length == 1", f"got={len(eh)}")
        _assert(int(proc_doc.get("items_count") or 0) == 1, "3f) procurement.items_count == 1",
                f"got={proc_doc.get('items_count')}")

        # 3g. Edge: items=[]
        bad_swap = dict(swap_body)
        bad_swap["items"] = []
        r = requests.put(
            f"{API}/vendor-procurement/{procurement_id}",
            headers=H,
            params={"reason": "empty"},
            json=bad_swap,
            timeout=30,
        )
        _assert(r.status_code == 400, "3g) PUT empty items -> 400", f"HTTP {r.status_code} {r.text[:200]}")

        bogus = f"nonexistent-{uuid.uuid4().hex}"
        r = requests.put(
            f"{API}/vendor-procurement/{bogus}",
            headers=H,
            params={"reason": "x"},
            json=swap_body,
            timeout=30,
        )
        _assert(r.status_code == 404, "3g) PUT non-existent procurement -> 404", f"HTTP {r.status_code} {r.text[:200]}")

        # =============== 4) Cleanup ===============
        # Delete TEST procurement (current)
        if created.get("procurement"):
            r = requests.delete(
                f"{API}/vendor-procurement/{created['procurement']}",
                headers=H,
                params={"reason": "test cleanup"},
                timeout=30,
            )
            _record("Cleanup: DELETE TEST procurement (post-edit)", r.status_code in (200, 400),
                    f"HTTP {r.status_code} {r.text[:120]}")

        # Delete the seed procurement too
        if seed_proc_id:
            r = requests.delete(
                f"{API}/vendor-procurement/{seed_proc_id}",
                headers=H,
                params={"reason": "test cleanup"},
                timeout=30,
            )
            _record("Cleanup: DELETE seed procurement", r.status_code in (200, 400),
                    f"HTTP {r.status_code} {r.text[:120]}")

        # Sale was already soft-deleted in 2g; idempotent re-delete OK if needed
        # Vendor + customer + products soft-delete
        if created.get("vendor"):
            r = requests.delete(f"{API}/vendors/{created['vendor']}", headers=H, timeout=30)
            _record("Cleanup: DELETE vendor", r.status_code == 200, f"HTTP {r.status_code} {r.text[:100]}")
        # Customer DELETE endpoint may or may not exist; try, don't fail if missing
        if created.get("customer"):
            r = requests.delete(f"{API}/customers/{created['customer']}", headers=H, timeout=30)
            _record("Cleanup: DELETE customer (best-effort)", r.status_code in (200, 404, 405),
                    f"HTTP {r.status_code} {r.text[:100]}")
        for pr in created["products"]:
            r = requests.delete(f"{API}/products/{pr['id']}", headers=H, timeout=30)
            _record(f"Cleanup: DELETE product {pr['name']}", r.status_code == 200,
                    f"HTTP {r.status_code} {r.text[:100]}")

    finally:
        passed = sum(1 for x in results if x["ok"])
        total = len(results)
        print(f"\n========== SUMMARY {passed}/{total} passed ==========")
        if failures:
            print("Failed cases:")
            for f in failures:
                print("  " + f)

    return 0 if not failures else 2


if __name__ == "__main__":
    sys.exit(main())
