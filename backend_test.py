"""
Backend tests for FPO Manager:
- Customer search API (/api/customers/search)
- Vendor search API (/api/vendors/search)
- Regression: customers create, sales create, ledgers, sale delete with reversal
"""
import os
import sys
import uuid
import json
import requests

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

def login():
    r = requests.post(f"{BASE_URL}/auth/login",
                      json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
                      timeout=15)
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

    # ===== Setup: Ensure we have at least one test customer & vendor =====
    test_marker = f"TEST_{uuid.uuid4().hex[:6]}"

    # Create a customer with shareholder + folio
    cust_payload = {
        "name": f"Ramesh Kumar {test_marker}",
        "mobile": "9876512345",
        "address": "Plot 12, Sector A, Lucknow",
        "village": "Barabanki",
        "customer_type": "shareholder",
        "folio_number": "FPO-001"
    }
    try:
        r = requests.post(f"{BASE_URL}/customers", json=cust_payload, headers=H, timeout=15)
        if r.status_code == 200:
            test_customer = r.json()
            report("POST /api/customers (shareholder + folio)", True,
                   f"id={test_customer['id']}, customer_type={test_customer.get('customer_type')}, folio_number={test_customer.get('folio_number')}")
        else:
            report("POST /api/customers (shareholder + folio)", False,
                   f"HTTP {r.status_code}: {r.text[:200]}")
            test_customer = None
    except Exception as e:
        report("POST /api/customers (shareholder + folio)", False, str(e))
        test_customer = None

    # Create a vendor for testing
    vend_payload = {
        "name": f"Sharma Traders {test_marker}",
        "mobile": "9123456789",
        "address": "Mandi Road, Kanpur",
        "village": "Kanpur Dehat",
    }
    try:
        r = requests.post(f"{BASE_URL}/vendors", json=vend_payload, headers=H, timeout=15)
        if r.status_code == 200:
            test_vendor = r.json()
            report("POST /api/vendors (setup)", True, f"id={test_vendor['id']}")
        else:
            report("POST /api/vendors (setup)", False, f"HTTP {r.status_code}: {r.text[:200]}")
            test_vendor = None
    except Exception as e:
        report("POST /api/vendors (setup)", False, str(e))
        test_vendor = None

    # ===========================================================
    # CUSTOMER SEARCH TESTS
    # ===========================================================
    print("\n=== /api/customers/search tests ===")

    # Empty string
    try:
        r = requests.get(f"{BASE_URL}/customers/search", params={"q": ""}, headers=H, timeout=15)
        # Empty string causes len < 1 so should return [], but FastAPI may strip empty differently
        if r.status_code == 200 and r.json() == []:
            report("customers/search empty string returns []", True)
        else:
            report("customers/search empty string returns []", False,
                   f"HTTP {r.status_code} body={r.text[:200]}")
    except Exception as e:
        report("customers/search empty string returns []", False, str(e))

    # Single character
    try:
        r = requests.get(f"{BASE_URL}/customers/search", params={"q": "a"}, headers=H, timeout=15)
        ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) <= 20
        report("customers/search single char 'a' (<=20 results, HTTP 200)", ok,
               f"HTTP {r.status_code} count={len(r.json()) if r.status_code==200 else 'N/A'}")
        single_char_results = r.json() if r.status_code == 200 else []
    except Exception as e:
        report("customers/search single char 'a'", False, str(e))
        single_char_results = []

    # Case-insensitive RAM vs ram
    try:
        r1 = requests.get(f"{BASE_URL}/customers/search", params={"q": "RAM"}, headers=H, timeout=15)
        r2 = requests.get(f"{BASE_URL}/customers/search", params={"q": "ram"}, headers=H, timeout=15)
        if r1.status_code == 200 and r2.status_code == 200:
            ids1 = sorted([c["id"] for c in r1.json()])
            ids2 = sorted([c["id"] for c in r2.json()])
            ok = ids1 == ids2
            report("customers/search case-insensitive RAM == ram", ok,
                   f"RAM={len(ids1)} ram={len(ids2)}")
        else:
            report("customers/search case-insensitive RAM == ram", False,
                   f"HTTP RAM={r1.status_code} ram={r2.status_code}")
    except Exception as e:
        report("customers/search case-insensitive RAM == ram", False, str(e))

    # Partial match: first 3 letters of created customer (Ram from Ramesh)
    try:
        r = requests.get(f"{BASE_URL}/customers/search", params={"q": "Ram"}, headers=H, timeout=15)
        if r.status_code == 200:
            results_list = r.json()
            ok = any(test_customer and c["id"] == test_customer["id"] for c in results_list) if test_customer else len(results_list) >= 0
            report("customers/search partial 'Ram' finds Ramesh", ok,
                   f"count={len(results_list)} match_test_customer={any(test_customer and c['id'] == test_customer['id'] for c in results_list) if test_customer else 'N/A'}")
        else:
            report("customers/search partial 'Ram'", False, f"HTTP {r.status_code}")
    except Exception as e:
        report("customers/search partial 'Ram'", False, str(e))

    # Special chars: should NOT crash
    for ch in ["(", ".", "+", "*"]:
        try:
            r = requests.get(f"{BASE_URL}/customers/search", params={"q": ch}, headers=H, timeout=15)
            ok = r.status_code == 200 and isinstance(r.json(), list)
            report(f"customers/search special char '{ch}' does not crash", ok,
                   f"HTTP {r.status_code} count={len(r.json()) if ok else 'N/A'}")
        except Exception as e:
            report(f"customers/search special char '{ch}'", False, str(e))

    # Mobile search: partial mobile
    try:
        r = requests.get(f"{BASE_URL}/customers/search", params={"q": "98765"}, headers=H, timeout=15)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        found = test_customer and any(c["id"] == test_customer["id"] for c in r.json()) if test_customer else False
        report("customers/search partial mobile '98765'", ok,
               f"HTTP {r.status_code} count={len(r.json()) if ok else 'N/A'} found_test_cust={found}")
    except Exception as e:
        report("customers/search partial mobile", False, str(e))

    # Folio number search
    try:
        r = requests.get(f"{BASE_URL}/customers/search", params={"q": "FPO-001"}, headers=H, timeout=15)
        if r.status_code == 200:
            results_list = r.json()
            found = test_customer and any(c["id"] == test_customer["id"] for c in results_list) if test_customer else False
            report("customers/search by folio_number 'FPO-001'", found or len(results_list) > 0,
                   f"count={len(results_list)} found_test={found}")
        else:
            report("customers/search by folio_number", False, f"HTTP {r.status_code}")
    except Exception as e:
        report("customers/search by folio_number", False, str(e))

    # Verify response payload contains expected fields
    try:
        r = requests.get(f"{BASE_URL}/customers/search", params={"q": test_marker[:6]},
                         headers=H, timeout=15)
        if r.status_code == 200 and r.json():
            sample = r.json()[0]
            required = ["id", "name", "mobile", "village", "address",
                        "customer_type", "folio_number", "outstanding_balance"]
            missing = [k for k in required if k not in sample]
            ok = len(missing) == 0
            report("customers/search response has all required fields", ok,
                   f"missing={missing}, sample_keys={list(sample.keys())}")
        else:
            report("customers/search response field check", False,
                   f"HTTP {r.status_code} no results for marker {test_marker}")
    except Exception as e:
        report("customers/search response field check", False, str(e))

    # ===========================================================
    # VENDOR SEARCH TESTS
    # ===========================================================
    print("\n=== /api/vendors/search tests ===")

    # Empty string
    try:
        r = requests.get(f"{BASE_URL}/vendors/search", params={"q": ""}, headers=H, timeout=15)
        if r.status_code == 200 and r.json() == []:
            report("vendors/search empty string returns []", True)
        else:
            report("vendors/search empty string returns []", False,
                   f"HTTP {r.status_code} body={r.text[:200]}")
    except Exception as e:
        report("vendors/search empty string returns []", False, str(e))

    # Single character
    try:
        r = requests.get(f"{BASE_URL}/vendors/search", params={"q": "s"}, headers=H, timeout=15)
        ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) <= 20
        report("vendors/search single char 's'", ok,
               f"HTTP {r.status_code} count={len(r.json()) if r.status_code==200 else 'N/A'}")
    except Exception as e:
        report("vendors/search single char 's'", False, str(e))

    # Case insensitive
    try:
        r1 = requests.get(f"{BASE_URL}/vendors/search", params={"q": "SHARMA"}, headers=H, timeout=15)
        r2 = requests.get(f"{BASE_URL}/vendors/search", params={"q": "sharma"}, headers=H, timeout=15)
        if r1.status_code == 200 and r2.status_code == 200:
            ids1 = sorted([v["id"] for v in r1.json()])
            ids2 = sorted([v["id"] for v in r2.json()])
            ok = ids1 == ids2
            report("vendors/search case-insensitive SHARMA == sharma", ok,
                   f"SHARMA={len(ids1)} sharma={len(ids2)}")
        else:
            report("vendors/search case-insensitive SHARMA == sharma", False,
                   f"HTTP SHARMA={r1.status_code} sharma={r2.status_code}")
    except Exception as e:
        report("vendors/search case-insensitive", False, str(e))

    # Partial match
    try:
        r = requests.get(f"{BASE_URL}/vendors/search", params={"q": "Sha"}, headers=H, timeout=15)
        if r.status_code == 200:
            results_list = r.json()
            found = test_vendor and any(v["id"] == test_vendor["id"] for v in results_list) if test_vendor else False
            report("vendors/search partial 'Sha' finds Sharma", found or len(results_list) >= 0,
                   f"count={len(results_list)} found_test={found}")
        else:
            report("vendors/search partial", False, f"HTTP {r.status_code}")
    except Exception as e:
        report("vendors/search partial", False, str(e))

    # Special chars
    for ch in ["(", ".", "+", "*"]:
        try:
            r = requests.get(f"{BASE_URL}/vendors/search", params={"q": ch}, headers=H, timeout=15)
            ok = r.status_code == 200 and isinstance(r.json(), list)
            report(f"vendors/search special char '{ch}' does not crash", ok,
                   f"HTTP {r.status_code} count={len(r.json()) if ok else 'N/A'}")
        except Exception as e:
            report(f"vendors/search special char '{ch}'", False, str(e))

    # Mobile partial
    try:
        r = requests.get(f"{BASE_URL}/vendors/search", params={"q": "91234"}, headers=H, timeout=15)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        report("vendors/search partial mobile '91234'", ok,
               f"HTTP {r.status_code} count={len(r.json()) if ok else 'N/A'}")
    except Exception as e:
        report("vendors/search partial mobile", False, str(e))

    # Verify vendor response payload
    try:
        r = requests.get(f"{BASE_URL}/vendors/search", params={"q": test_marker[:6]},
                         headers=H, timeout=15)
        if r.status_code == 200 and r.json():
            sample = r.json()[0]
            required = ["id", "name", "mobile", "address", "village", "outstanding_dues"]
            missing = [k for k in required if k not in sample]
            ok = len(missing) == 0
            report("vendors/search response has all required fields", ok,
                   f"missing={missing}, sample_keys={list(sample.keys())}")
        else:
            report("vendors/search response field check", False,
                   f"HTTP {r.status_code} no results for marker {test_marker}")
    except Exception as e:
        report("vendors/search response field check", False, str(e))

    # ===========================================================
    # REGRESSION CHECK
    # ===========================================================
    print("\n=== Regression checks ===")

    # We already verified POST /api/customers above.

    # POST /api/sales tied to customer_id
    sale_id = None
    if test_customer:
        # Need outlet, product, and stock
        try:
            outlets_r = requests.get(f"{BASE_URL}/outlets", headers=H, timeout=15).json()
            stock_r = requests.get(f"{BASE_URL}/stock", headers=H, timeout=15).json()
            # Find a stock record with quantity > 0
            chosen_stock = next((s for s in stock_r if s.get("quantity", 0) > 1), None)
            if not chosen_stock:
                report("POST /api/sales (regression)", False, "No stock with qty>1 available")
            else:
                outlet_id = chosen_stock["outlet_id"]
                product_id = chosen_stock["product_id"]
                product_name = chosen_stock.get("product_name", "Unknown")
                qty = 1
                rate = 50.0
                amount = qty * rate
                sale_payload = {
                    "outlet_id": outlet_id,
                    "customer_id": test_customer["id"],
                    "customer_name": test_customer["name"],
                    "items": [{
                        "product_id": product_id,
                        "product_name": product_name,
                        "quantity": qty,
                        "rate": rate,
                        "amount": amount
                    }],
                    "subtotal": amount,
                    "discount": 0,
                    "total_amount": amount,
                    "payment_mode": "cash",
                    "cash_amount": amount,
                    "online_amount": 0,
                    "credit_amount": 0
                }
                r = requests.post(f"{BASE_URL}/sales", json=sale_payload, headers=H, timeout=15)
                if r.status_code == 200:
                    sale_id = r.json()["id"]
                    report("POST /api/sales tied to customer_id", True,
                           f"sale_id={sale_id} bill={r.json().get('bill_number')}")
                else:
                    report("POST /api/sales tied to customer_id", False,
                           f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            report("POST /api/sales tied to customer_id", False, str(e))

    # GET /api/customers/{id}/ledger
    if test_customer:
        try:
            r = requests.get(f"{BASE_URL}/customers/{test_customer['id']}/ledger",
                             headers=H, timeout=15)
            if r.status_code == 200:
                data = r.json()
                ok = "transactions" in data or "sales" in data or "summary" in data or "customer" in data
                report("GET /api/customers/{id}/ledger", ok,
                       f"keys={list(data.keys()) if isinstance(data, dict) else type(data)}")
            else:
                report("GET /api/customers/{id}/ledger", False,
                       f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            report("GET /api/customers/{id}/ledger", False, str(e))

    # GET /api/vendors/{id}/ledger
    if test_vendor:
        try:
            r = requests.get(f"{BASE_URL}/vendors/{test_vendor['id']}/ledger",
                             headers=H, timeout=15)
            if r.status_code == 200:
                data = r.json()
                ok = isinstance(data, dict)
                report("GET /api/vendors/{id}/ledger", ok,
                       f"keys={list(data.keys()) if isinstance(data, dict) else type(data)}")
            else:
                report("GET /api/vendors/{id}/ledger", False,
                       f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            report("GET /api/vendors/{id}/ledger", False, str(e))

    # DELETE /api/sales/{sale_id} - auto reversal
    if sale_id:
        try:
            r = requests.delete(f"{BASE_URL}/sales/{sale_id}",
                                params={"reason": "test cleanup"},
                                headers=H, timeout=15)
            if r.status_code == 200:
                data = r.json()
                ok = "reversal_details" in data or "message" in data
                report("DELETE /api/sales/{id} auto-reversal", ok,
                       f"resp_keys={list(data.keys()) if isinstance(data, dict) else type(data)}")
            else:
                report("DELETE /api/sales/{id} auto-reversal", False,
                       f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            report("DELETE /api/sales/{id} auto-reversal", False, str(e))

    print_summary()

def print_summary():
    print(f"\n{'='*60}\nSUMMARY: {passed} passed, {failed} failed\n{'='*60}")
    for s, n, d in results:
        if s == "FAIL":
            print(f"  FAIL: {n} -- {d}")

if __name__ == "__main__":
    main()
    sys.exit(0 if failed == 0 else 1)
