"""
Focused test for: Dashboard - Exclude Cancelled/Deleted Sales from Aggregates
Verifies that POST /api/sales increments dashboard.today aggregates and DELETE/PUT reverses them.
Uses TEST_<uuid> prefixed entities. Cleans up after itself.
"""
import os
import sys
import uuid
import requests

BASE = "https://transaction-mgmt-dev.preview.emergentagent.com/api"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

TEST_TAG = f"TEST_{uuid.uuid4().hex[:8]}"

session = requests.Session()


def login():
    r = session.post(f"{BASE}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    print(f"[OK] Admin login")
    return token


def get_dashboard():
    r = session.get(f"{BASE}/dashboard", timeout=30)
    assert r.status_code == 200, f"Dashboard failed: {r.status_code} {r.text}"
    return r.json()


def pick_outlet_with_stock():
    """Find an outlet that has stock for at least one active product."""
    r = session.get(f"{BASE}/stock", timeout=30)
    assert r.status_code == 200, f"stock GET failed: {r.text}"
    stocks = r.json()
    for s in stocks:
        if s.get("quantity", 0) >= 5:
            return s["outlet_id"], s["product_id"], s
    return None, None, None


def get_product(product_id):
    r = session.get(f"{BASE}/products", timeout=30)
    for p in r.json():
        if p["id"] == product_id:
            return p
    return None


def create_test_customer():
    payload = {
        "name": f"Dashboard Test Customer {TEST_TAG}",
        "mobile": f"9{uuid.uuid4().int % 1000000000:09d}",
        "customer_type": "walk_in",
        "village": "Test Village",
    }
    r = session.post(f"{BASE}/customers", json=payload, timeout=30)
    assert r.status_code == 200, f"Customer POST failed: {r.status_code} {r.text}"
    cid = r.json()["id"]
    print(f"[OK] Created TEST customer id={cid}")
    return cid


def create_sale(outlet_id, product_id, product_name, customer_id, payment_mode="cash", total=200.0):
    item_amt = total
    body = {
        "outlet_id": outlet_id,
        "customer_id": customer_id,
        "customer_name": f"Dashboard Test Customer {TEST_TAG}",
        "items": [
            {
                "product_id": product_id,
                "product_name": product_name,
                "quantity": 2.0,
                "rate": 100.0,
                "amount": item_amt,
            }
        ],
        "subtotal": item_amt,
        "discount": 0,
        "total_amount": total,
        "payment_mode": payment_mode,
        "cash_amount": total if payment_mode == "cash" else 0,
        "online_amount": 0,
        "credit_amount": total if payment_mode == "credit" else 0,
        "notes": f"{TEST_TAG} dashboard test",
    }
    r = session.post(f"{BASE}/sales", json=body, timeout=30)
    assert r.status_code == 200, f"Sales POST failed: {r.status_code} {r.text}"
    sale = r.json()
    print(f"[OK] Created sale id={sale['id']} bill={sale.get('bill_number')} mode={payment_mode} total={total}")
    return sale


def delete_sale(sale_id, reason="dashboard test"):
    r = session.delete(f"{BASE}/sales/{sale_id}", params={"reason": reason}, timeout=30)
    assert r.status_code == 200, f"Sale DELETE failed: {r.status_code} {r.text}"
    print(f"[OK] Deleted sale {sale_id}")


def cleanup_customer(cid):
    try:
        r = session.delete(f"{BASE}/customers/{cid}", timeout=15)
        print(f"[cleanup] customer DELETE -> {r.status_code}")
    except Exception as e:
        print(f"[cleanup] customer delete error: {e}")


def approx(a, b, tol=0.01):
    return abs(float(a) - float(b)) <= tol


def main():
    results = []

    def record(name, ok, detail=""):
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name} {detail}")
        results.append((name, ok, detail))

    login()

    # Sub-test 1: Capture baseline
    baseline = get_dashboard()
    base_today = baseline["today"]
    print(f"BASELINE today: total={base_today['total']}, cash={base_today['cash']}, credit={base_today['credit']}, count={base_today['sales_count']}")
    print(f"BASELINE month total: {baseline['month']['total']}")
    record("1) GET /api/dashboard baseline", True, f"total={base_today['total']} count={base_today['sales_count']}")

    # Sub-test 2: Setup customer, find outlet/product with stock
    outlet_id, product_id, stock_row = pick_outlet_with_stock()
    if not outlet_id:
        record("2) outlet+product with stock", False, "no outlet has stock >=5")
        return results
    prod = get_product(product_id)
    product_name = prod.get("name") if prod else "Test Product"
    print(f"[OK] Using outlet={outlet_id} product={product_id} ({product_name}); stock qty={stock_row.get('quantity')}")

    customer_id = create_test_customer()
    record("2) Setup customer/outlet/product", True, f"customer={customer_id}, outlet={outlet_id}")

    # Sub-test 3: Create cash sale
    sale = create_sale(outlet_id, product_id, product_name, customer_id, payment_mode="cash", total=200.0)
    sale_id = sale["id"]
    record("3) POST /api/sales (cash 200)", True, f"sale_id={sale_id}")

    # Sub-test 4: Verify dashboard reflects new sale
    after_create = get_dashboard()["today"]
    ok_total = approx(after_create["total"], base_today["total"] + 200)
    ok_cash = approx(after_create["cash"], base_today["cash"] + 200)
    ok_count = after_create["sales_count"] == base_today["sales_count"] + 1
    detail4 = f"total={after_create['total']} (expect {base_today['total']+200}); cash={after_create['cash']} (expect {base_today['cash']+200}); count={after_create['sales_count']} (expect {base_today['sales_count']+1})"
    record("4) Dashboard reflects new cash sale", ok_total and ok_cash and ok_count, detail4)

    # Sub-test 5: Delete the sale
    delete_sale(sale_id, reason="dashboard test")
    record("5) DELETE /api/sales/{sale_id}", True)

    # Sub-test 6: Dashboard returns to baseline
    after_delete = get_dashboard()["today"]
    ok_total6 = approx(after_delete["total"], base_today["total"])
    ok_cash6 = approx(after_delete["cash"], base_today["cash"])
    ok_count6 = after_delete["sales_count"] == base_today["sales_count"]
    detail6 = f"total={after_delete['total']} (expect {base_today['total']}); cash={after_delete['cash']} (expect {base_today['cash']}); count={after_delete['sales_count']} (expect {base_today['sales_count']})"
    record("6) Dashboard reverts to baseline after DELETE (CORE FIX)", ok_total6 and ok_cash6 and ok_count6, detail6)

    # Sub-test 7 (Bonus): Credit sale, PUT to cash, verify, then DELETE
    sale_credit = create_sale(outlet_id, product_id, product_name, customer_id, payment_mode="credit", total=200.0)
    sale_credit_id = sale_credit["id"]
    after_credit_create = get_dashboard()["today"]
    ok_credit_up = approx(after_credit_create["credit"], base_today["credit"] + 200)
    ok_total_up = approx(after_credit_create["total"], base_today["total"] + 200)
    detail7a = f"credit={after_credit_create['credit']} (expect {base_today['credit']+200}); total={after_credit_create['total']} (expect {base_today['total']+200})"
    record("7a) Credit sale increments today.credit", ok_credit_up and ok_total_up, detail7a)

    # Now PUT to change to cash
    put_body = {
        "outlet_id": outlet_id,
        "customer_id": customer_id,
        "customer_name": f"Dashboard Test Customer {TEST_TAG}",
        "items": [
            {
                "product_id": product_id,
                "product_name": product_name,
                "quantity": 2.0,
                "rate": 100.0,
                "amount": 200.0,
            }
        ],
        "subtotal": 200.0,
        "discount": 0,
        "total_amount": 200.0,
        "payment_mode": "cash",
        "cash_amount": 200.0,
        "online_amount": 0,
        "credit_amount": 0,
        "notes": f"{TEST_TAG} PUT to cash",
    }
    r = session.put(f"{BASE}/sales/{sale_credit_id}", json=put_body, params={"reason": "switch to cash"}, timeout=30)
    if r.status_code != 200:
        record("7b) PUT /api/sales/{id} switch to cash", False, f"HTTP {r.status_code}: {r.text[:200]}")
    else:
        after_put = get_dashboard()["today"]
        ok_credit_back = approx(after_put["credit"], base_today["credit"])
        ok_cash_up = approx(after_put["cash"], base_today["cash"] + 200)
        ok_total_unchanged = approx(after_put["total"], base_today["total"] + 200)
        detail7b = f"credit={after_put['credit']} (expect {base_today['credit']}); cash={after_put['cash']} (expect {base_today['cash']+200}); total={after_put['total']} (expect {base_today['total']+200})"
        record("7b) PUT switches credit→cash in dashboard", ok_credit_back and ok_cash_up and ok_total_unchanged, detail7b)

    # Delete that one too
    delete_sale(sale_credit_id, reason="cleanup")
    after_final = get_dashboard()["today"]
    ok_final = (approx(after_final["total"], base_today["total"]) and
                approx(after_final["cash"], base_today["cash"]) and
                approx(after_final["credit"], base_today["credit"]) and
                after_final["sales_count"] == base_today["sales_count"])
    detail7c = f"total={after_final['total']}, cash={after_final['cash']}, credit={after_final['credit']}, count={after_final['sales_count']}"
    record("7c) DELETE returns to baseline (after PUT)", ok_final, detail7c)

    # Cleanup
    cleanup_customer(customer_id)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}: {detail}")
    print(f"\n{passed}/{total} sub-tests PASSED")
    return results


if __name__ == "__main__":
    try:
        results = main()
        failed = [r for r in results if not r[1]]
        sys.exit(0 if not failed else 1)
    except AssertionError as e:
        print(f"FATAL: {e}")
        sys.exit(2)
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(3)
