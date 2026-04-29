"""
Phase 3 Backend tests (Feb 2026) for FPO Manager:
- Product Varieties feature
- Sale items with variety_id / variety_name
- Cancelled transactions in customer ledger
- Cancelled transactions in vendor ledger (depends on vendor-procurement delete endpoint)
- GET /api/sales/{sale_id} (no _id leak)
- Regression: customer/vendor search, customer type=shareholder
"""
import os
import sys
import uuid
import json
import requests
from datetime import datetime

BASE_URL = "https://transaction-mgmt-dev.preview.emergentagent.com/api"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

passed = 0
failed = 0
results = []


def report(name, ok, detail=""):
    global passed, failed
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    line = f"[{status}] {name} - {detail}"
    print(line)
    results.append((status, name, detail))


def print_summary():
    print("\n" + "=" * 80)
    print(f"SUMMARY: {passed} passed, {failed} failed (total {passed + failed})")
    print("=" * 80)
    if failed:
        print("\nFAILED CASES:")
        for s, n, d in results:
            if s == "FAIL":
                print(f"  - {n}: {d}")


def login():
    r = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def main():
    try:
        token = login()
        report("Admin login", True, "token obtained")
    except Exception as e:
        report("Admin login", False, str(e))
        print_summary()
        sys.exit(1)

    H = {"Authorization": f"Bearer {token}"}
    H_json = {**H, "Content-Type": "application/json"}
    marker = f"TEST_{uuid.uuid4().hex[:6]}"

    # ============================================================
    # 1. PRODUCT VARIETIES
    # ============================================================
    print("\n--- 1. Product Varieties ---")
    
    # 1a. Create product with varieties
    rice_name = f"TEST_Rice_{marker}"
    payload_rice = {
        "name": rice_name,
        "unit": "kg",
        "category": "produce",
        "varieties": [
            {"name": "Basmati", "name_hi": "बासमती"},
            {"name": "Sona Masoori"},
        ],
    }
    r = requests.post(f"{BASE_URL}/products", headers=H_json, json=payload_rice, timeout=15)
    rice_id = None
    if r.status_code == 200:
        body = r.json()
        rice_id = body.get("id")
        varieties = body.get("varieties", [])
        # Validate each variety has auto-generated id
        ids_ok = len(varieties) == 2 and all(v.get("id") for v in varieties)
        names_ok = {v["name"] for v in varieties} == {"Basmati", "Sona Masoori"}
        hi_ok = any(v.get("name_hi") == "बासमती" for v in varieties)
        report("POST /products with varieties", ids_ok and names_ok and hi_ok,
               f"status=200, varieties={varieties}")
    else:
        report("POST /products with varieties", False, f"status={r.status_code} body={r.text[:200]}")

    # 1b. GET /products → confirm varieties preserved
    r = requests.get(f"{BASE_URL}/products", headers=H, timeout=15)
    if r.status_code == 200 and rice_id:
        plist = r.json()
        match = next((p for p in plist if p.get("id") == rice_id), None)
        if match:
            v = match.get("varieties", [])
            ok = len(v) == 2 and {x["name"] for x in v} == {"Basmati", "Sona Masoori"}
            report("GET /products — varieties preserved", ok, f"varieties={v}")
        else:
            report("GET /products — varieties preserved", False, "rice product not found in list")
    else:
        report("GET /products — varieties preserved", False, f"status={r.status_code}")

    # 1c. PUT /products/{id} → update varieties
    if rice_id:
        r = requests.put(
            f"{BASE_URL}/products/{rice_id}",
            headers=H_json,
            json={"varieties": [{"name": "Swarna"}]},
            timeout=15,
        )
        put_ok = r.status_code == 200
        # verify
        if put_ok:
            r2 = requests.get(f"{BASE_URL}/products/{rice_id}", headers=H, timeout=15)
            if r2.status_code == 200:
                v = r2.json().get("varieties", [])
                ok = len(v) == 1 and v[0]["name"] == "Swarna"
                report("PUT /products/{id} varieties update", ok, f"varieties={v}")
            else:
                report("PUT /products/{id} varieties update", False, f"get after put status={r2.status_code}")
        else:
            report("PUT /products/{id} varieties update", False, f"status={r.status_code} body={r.text[:200]}")

    # 1d. POST /products without varieties field (backward compat)
    plain_name = f"TEST_Plain_{marker}"
    r = requests.post(
        f"{BASE_URL}/products",
        headers=H_json,
        json={"name": plain_name, "unit": "kg", "category": "produce"},
        timeout=15,
    )
    plain_id = None
    if r.status_code == 200:
        b = r.json()
        plain_id = b.get("id")
        ok = b.get("varieties") == []
        report("POST /products without varieties (default [])", ok, f"varieties={b.get('varieties')}")
    else:
        report("POST /products without varieties (default [])", False, f"status={r.status_code} body={r.text[:200]}")

    # ============================================================
    # 2. SALES WITH VARIETY — need stock; create outlet + stock + customer first
    # ============================================================
    print("\n--- 2. Sale with Variety ---")
    
    # Find any outlet
    r = requests.get(f"{BASE_URL}/outlets", headers=H, timeout=15)
    outlets = r.json() if r.status_code == 200 else []
    outlet_id = outlets[0]["id"] if outlets else None
    
    # Create stock for the rice product at outlet (so sale works)
    if rice_id and outlet_id:
        requests.post(
            f"{BASE_URL}/stock/add",
            headers=H_json,
            json={"product_id": rice_id, "outlet_id": outlet_id, "quantity": 100},
            timeout=15,
        )
    
    # Create a customer for this test
    cust_payload = {
        "name": f"Variety Buyer {marker}",
        "mobile": "9000012345",
        "village": "Test Village",
        "customer_type": "walk_in",
    }
    r = requests.post(f"{BASE_URL}/customers", headers=H_json, json=cust_payload, timeout=15)
    cust_id = r.json()["id"] if r.status_code == 200 else None

    sale_id_var = None
    variety_id_val = None
    if rice_id and outlet_id and cust_id:
        # Get the current variety (Swarna after update) to use its id
        r = requests.get(f"{BASE_URL}/products/{rice_id}", headers=H, timeout=15)
        varieties = r.json().get("varieties", []) if r.status_code == 200 else []
        if varieties:
            variety_id_val = varieties[0]["id"]
            variety_name_val = varieties[0]["name"]
            
            sale_payload = {
                "outlet_id": outlet_id,
                "customer_id": cust_id,
                "customer_name": cust_payload["name"],
                "items": [{
                    "product_id": rice_id,
                    "product_name": rice_name,
                    "quantity": 2,
                    "rate": 50,
                    "amount": 100,
                    "variety_id": variety_id_val,
                    "variety_name": variety_name_val,
                }],
                "subtotal": 100,
                "discount": 0,
                "total_amount": 100,
                "payment_mode": "cash",
                "cash_amount": 100,
                "online_amount": 0,
                "credit_amount": 0,
            }
            r = requests.post(f"{BASE_URL}/sales", headers=H_json, json=sale_payload, timeout=15)
            if r.status_code == 200:
                b = r.json()
                sale_id_var = b.get("id")
                items = b.get("items", [])
                ok = items and items[0].get("variety_id") == variety_id_val and items[0].get("variety_name") == variety_name_val
                report("POST /sales with variety", ok, f"items[0].variety_id/name match: {ok}")
            else:
                report("POST /sales with variety", False, f"status={r.status_code} body={r.text[:300]}")
        else:
            report("POST /sales with variety", False, "no varieties on rice product to use")

    # 2b. Retrieve the sale and confirm variety_id/variety_name preserved
    if sale_id_var:
        r = requests.get(f"{BASE_URL}/sales/{sale_id_var}", headers=H, timeout=15)
        if r.status_code == 200:
            b = r.json()
            items = b.get("items", [])
            ok = items and items[0].get("variety_id") == variety_id_val and items[0].get("variety_name")
            # Also confirm no _id leak
            no_id = "_id" not in b
            report("GET /sales/{id} variety preserved + no _id", ok and no_id,
                   f"variety_preserved={ok}, no_mongo_id={no_id}")
        else:
            report("GET /sales/{id} variety preserved + no _id", False, f"status={r.status_code}")

    # ============================================================
    # 3. CANCELLED TRANSACTIONS IN CUSTOMER LEDGER
    # ============================================================
    print("\n--- 3. Cancelled sales in customer ledger ---")
    
    # Create a dedicated customer
    cust2_payload = {
        "name": f"Cancel Test Customer {marker}",
        "mobile": "9000067890",
        "village": "Cancel Village",
        "customer_type": "walk_in",
    }
    r = requests.post(f"{BASE_URL}/customers", headers=H_json, json=cust2_payload, timeout=15)
    cust2_id = r.json()["id"] if r.status_code == 200 else None
    
    sale_to_cancel_id = None
    sale_to_cancel_bill = None
    if cust2_id and rice_id and outlet_id:
        # Credit sale (credit_amount > 0 => affects outstanding)
        sale_payload = {
            "outlet_id": outlet_id,
            "customer_id": cust2_id,
            "customer_name": cust2_payload["name"],
            "items": [{
                "product_id": rice_id,
                "product_name": rice_name,
                "quantity": 5,
                "rate": 60,
                "amount": 300,
            }],
            "subtotal": 300,
            "discount": 0,
            "total_amount": 300,
            "payment_mode": "credit",
            "cash_amount": 0,
            "online_amount": 0,
            "credit_amount": 300,
        }
        r = requests.post(f"{BASE_URL}/sales", headers=H_json, json=sale_payload, timeout=15)
        if r.status_code == 200:
            sale_to_cancel_id = r.json()["id"]
            sale_to_cancel_bill = r.json().get("bill_number")
            report("Setup: create credit sale for customer cancel test", True, f"sale_id={sale_to_cancel_id}")
        else:
            report("Setup: create credit sale for customer cancel test", False, f"status={r.status_code} body={r.text[:200]}")

    # Pre-delete — check ledger summary totals
    pre_total_billed = 0
    pre_credit = 0
    if cust2_id:
        r = requests.get(f"{BASE_URL}/customers/{cust2_id}/ledger", headers=H, timeout=15)
        if r.status_code == 200:
            s = r.json().get("summary", {})
            pre_total_billed = s.get("total_billed", 0)
            pre_credit = s.get("total_credit_given", 0)

    # DELETE sale with reason
    if sale_to_cancel_id:
        r = requests.delete(
            f"{BASE_URL}/sales/{sale_to_cancel_id}?reason=test cancel",
            headers=H,
            timeout=15,
        )
        del_ok = r.status_code == 200
        report("DELETE /sales/{id}?reason=test cancel", del_ok,
               f"status={r.status_code} body={r.text[:200] if not del_ok else 'reversed'}")

        # Fetch ledger again
        r = requests.get(f"{BASE_URL}/customers/{cust2_id}/ledger", headers=H, timeout=15)
        if r.status_code == 200:
            body = r.json()
            txs = body.get("transactions", [])
            cancelled_tx = next((t for t in txs if t.get("id") == sale_to_cancel_id), None)
            # Assertion a: cancelled sale still in transactions
            still_there = cancelled_tx is not None
            report("Cancelled sale STILL in ledger.transactions", still_there,
                   f"found={still_there}")
            if cancelled_tx:
                # is_cancelled: True
                flag_ok = cancelled_tx.get("is_cancelled") is True
                report("cancelled tx.is_cancelled == True", flag_ok,
                       f"value={cancelled_tx.get('is_cancelled')}")
                # deleted_at populated
                dat_ok = cancelled_tx.get("deleted_at") is not None
                report("cancelled tx.deleted_at populated", dat_ok,
                       f"value={cancelled_tx.get('deleted_at')}")
                # deletion_reason == "test cancel"
                reason_ok = cancelled_tx.get("deletion_reason") == "test cancel"
                report("cancelled tx.deletion_reason == 'test cancel'", reason_ok,
                       f"value={cancelled_tx.get('deletion_reason')}")
                # debit == 0
                debit_ok = cancelled_tx.get("debit", -1) == 0
                report("cancelled tx.debit == 0", debit_ok,
                       f"value={cancelled_tx.get('debit')}")
            # Summary totals exclude cancelled sale
            s2 = body.get("summary", {})
            # Sale was 300, credit 300. After delete, totals should NOT include it.
            excl_billed = s2.get("total_billed", 0) == (pre_total_billed - 300)
            excl_credit = s2.get("total_credit_given", 0) == (pre_credit - 300)
            report("summary.total_billed EXCLUDES cancelled", excl_billed,
                   f"pre={pre_total_billed}, post={s2.get('total_billed')}, expected diff=-300")
            report("summary.total_credit_given EXCLUDES cancelled", excl_credit,
                   f"pre={pre_credit}, post={s2.get('total_credit_given')}, expected diff=-300")
        else:
            report("GET ledger after cancel", False, f"status={r.status_code}")

    # ============================================================
    # 4. CANCELLED TRANSACTIONS IN VENDOR LEDGER
    # ============================================================
    print("\n--- 4. Cancelled purchases in vendor ledger ---")

    # Create vendor
    vend_payload = {
        "name": f"Cancel Vendor {marker}",
        "mobile": "9111122222",
        "address": "Vendor Addr",
        "village": "Vendor Village",
    }
    r = requests.post(f"{BASE_URL}/vendors", headers=H_json, json=vend_payload, timeout=15)
    vend_id = r.json()["id"] if r.status_code == 200 else None

    proc_id = None
    if vend_id and outlet_id and rice_id:
        proc_payload = {
            "vendor_id": vend_id,
            "product_id": rice_id,
            "quantity": 10,
            "rate": 30,
            "outlet_id": outlet_id,
            "payment_mode": "credit",
            "cash_amount": 0,
            "online_amount": 0,
        }
        r = requests.post(f"{BASE_URL}/vendor-procurement", headers=H_json, json=proc_payload, timeout=15)
        if r.status_code == 200:
            proc_id = r.json().get("procurement_id")
            report("Setup: create credit vendor procurement", True, f"proc_id={proc_id}")
        else:
            report("Setup: create credit vendor procurement", False, f"status={r.status_code} body={r.text[:200]}")

    # Try to DELETE vendor procurement — attempt multiple potential endpoints
    delete_endpoint_found = False
    delete_response_info = ""
    for ep in [
        f"/vendor-procurement/{proc_id}",
        f"/vendor-procurement/{proc_id}?reason=test cancel",
        f"/purchases/{proc_id}?reason=test cancel",
    ]:
        if not proc_id:
            break
        r = requests.delete(f"{BASE_URL}{ep}", headers=H, timeout=15)
        delete_response_info = f"DELETE {ep} -> {r.status_code}"
        if r.status_code == 200:
            delete_endpoint_found = True
            break

    if proc_id:
        report("DELETE vendor procurement endpoint exists", delete_endpoint_found,
               delete_response_info or "no endpoint responded 200")

    # Even without delete endpoint, we can still verify that vendor ledger includes purchases
    # AND check format. If delete endpoint missing, the cancelled assertions fail by design.
    if vend_id and proc_id:
        r = requests.get(f"{BASE_URL}/vendors/{vend_id}/ledger", headers=H, timeout=15)
        if r.status_code == 200:
            body = r.json()
            txs = body.get("transactions", [])
            found_tx = next((t for t in txs if t.get("id") == proc_id), None)
            report("vendor ledger has purchase", found_tx is not None,
                   f"found={found_tx is not None}")
            if delete_endpoint_found and found_tx:
                flag_ok = found_tx.get("is_cancelled") is True
                report("vendor cancelled tx.is_cancelled", flag_ok,
                       f"value={found_tx.get('is_cancelled')}")
                debit_ok = found_tx.get("debit", -1) == 0
                report("vendor cancelled tx.debit == 0", debit_ok,
                       f"value={found_tx.get('debit')}")
                reason_ok = bool(found_tx.get("deletion_reason"))
                report("vendor cancelled tx.deletion_reason present", reason_ok,
                       f"value={found_tx.get('deletion_reason')}")
                # Summary excludes cancelled
                s = body.get("summary", {})
                # Before delete, total_purchases included 300 (10*30). After delete it should be 0-ish
                report("vendor summary excludes cancelled purchase (total_purchases=0 for this test vendor)",
                       s.get("total_purchases", -1) == 0,
                       f"value={s.get('total_purchases')}")
        else:
            report("GET vendor ledger", False, f"status={r.status_code}")

    # ============================================================
    # 5. GET /api/sales/{sale_id} — no ObjectId leak, has outlet info
    # ============================================================
    print("\n--- 5. GET /sales/{id} shape ---")
    
    if sale_id_var:
        r = requests.get(f"{BASE_URL}/sales/{sale_id_var}", headers=H, timeout=15)
        if r.status_code == 200:
            # raw text should be valid JSON (no ObjectId serialization issue)
            try:
                b = r.json()
                no_id = "_id" not in b
                has_items = "items" in b
                has_outlet_name = "outlet_name" in b
                has_outlet_address = "outlet_address" in b
                all_ok = no_id and has_items and has_outlet_name and has_outlet_address
                report("GET /sales/{id} full doc (no _id, has outlet info)", all_ok,
                       f"no_id={no_id}, items={has_items}, outlet_name={has_outlet_name}, outlet_address={has_outlet_address}")
            except Exception as e:
                report("GET /sales/{id} JSON parse", False, str(e))
        else:
            report("GET /sales/{id}", False, f"status={r.status_code}")

    # ============================================================
    # REGRESSION CHECKS
    # ============================================================
    print("\n--- Regression ---")

    # Customer search
    r = requests.get(f"{BASE_URL}/customers/search?q=Ramesh", headers=H, timeout=15)
    if r.status_code == 200:
        res = r.json()
        ok = isinstance(res, list)
        if ok and res:
            fields = {"id", "name", "mobile", "village", "customer_type", "folio_number", "outstanding_balance"}
            ok = fields.issubset(res[0].keys())
        report("GET /customers/search regression", ok, f"results={len(res)}")
    else:
        report("GET /customers/search regression", False, f"status={r.status_code}")

    # Vendor search
    r = requests.get(f"{BASE_URL}/vendors/search?q=Vendor", headers=H, timeout=15)
    if r.status_code == 200:
        res = r.json()
        ok = isinstance(res, list)
        if ok and res:
            fields = {"id", "name", "mobile", "address", "village", "outstanding_dues"}
            ok = fields.issubset(res[0].keys())
        report("GET /vendors/search regression", ok, f"results={len(res)}")
    else:
        report("GET /vendors/search regression", False, f"status={r.status_code}")

    # POST shareholder customer with folio
    r = requests.post(
        f"{BASE_URL}/customers",
        headers=H_json,
        json={
            "name": f"Shareholder {marker}",
            "mobile": "9555544444",
            "customer_type": "shareholder",
            "folio_number": "FPO-TEST-1",
        },
        timeout=15,
    )
    if r.status_code == 200:
        b = r.json()
        ok = b.get("customer_type") == "shareholder" and b.get("folio_number") == "FPO-TEST-1"
        report("POST /customers shareholder+folio regression", ok,
               f"type={b.get('customer_type')}, folio={b.get('folio_number')}")
    else:
        report("POST /customers shareholder+folio regression", False,
               f"status={r.status_code} body={r.text[:200]}")

    # Cleanup: soft-delete TEST_ products
    for pid in [rice_id, plain_id]:
        if pid:
            try:
                requests.delete(f"{BASE_URL}/products/{pid}", headers=H, timeout=10)
            except Exception:
                pass

    print_summary()


if __name__ == "__main__":
    main()
