"""
Focused backend tests for the review request:
1) /api/reports/transactions (json + csv)
2) /api/reports/raw (admin-only csv)
3) /api/vendor-procurement (admin)
4) Regression: /api/search/global, /api/customers/search
"""
import os
import sys
import json
import requests

BACKEND_URL = "https://transaction-mgmt-dev.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

results = []


def log(name, ok, msg=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} {('- ' + msg) if msg else ''}")
    results.append((name, ok, msg))


def login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # Admin login
    try:
        token = login(ADMIN_USER, ADMIN_PASS)
        log("Admin login", True)
    except Exception as e:
        log("Admin login", False, str(e))
        return
    H = auth_headers(token)

    # Find an existing customer with sales (to test customer_id filter)
    sample_customer_id = None
    try:
        r = requests.get(f"{API}/sales", headers=H, timeout=30)
        if r.status_code == 200:
            for s in r.json():
                if s.get("customer_id"):
                    sample_customer_id = s["customer_id"]
                    break
    except Exception:
        pass

    # ========================================================================
    # 1) /api/reports/transactions?type=all&format=json
    # ========================================================================
    try:
        r = requests.get(f"{API}/reports/transactions", params={"type": "all", "format": "json"}, headers=H, timeout=30)
        ok = r.status_code == 200
        body = {}
        if ok:
            body = r.json()
            ok = isinstance(body, dict) and "count" in body and "rows" in body and isinstance(body["rows"], list)
        log("GET /reports/transactions?type=all&format=json -> 200 with {count,rows}", ok,
            f"status={r.status_code}, count={body.get('count') if isinstance(body, dict) else 'n/a'}")
        # Verify row schema
        rows = body.get("rows", []) if isinstance(body, dict) else []
        required_keys = {
            "date", "time", "type", "reference", "person_name", "outlet",
            "product", "variety", "quantity", "rate", "amount", "total",
            "payment_mode", "is_cancelled",
        }
        if rows:
            first = rows[0]
            missing = required_keys - set(first.keys())
            log("Row schema contains all required keys", not missing,
                f"missing={sorted(missing) if missing else 'none'}")
        else:
            log("Row schema check (skipped, no rows)", True)
    except Exception as e:
        log("GET /reports/transactions json", False, str(e))

    # ========================================================================
    # 2) /api/reports/transactions?type=sale&format=csv
    # ========================================================================
    try:
        r = requests.get(f"{API}/reports/transactions", params={"type": "sale", "format": "csv"}, headers=H, timeout=30)
        ok_status = r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        cd = r.headers.get("Content-Disposition", "")
        ok_ct = "text/csv" in ct.lower()
        ok_cd = ("attachment" in cd.lower()) and ("transactions_" in cd) and (cd.strip().endswith(".csv"))
        body = r.text
        expected_header = "date,time,type,reference,person_name,outlet,product,variety,quantity,rate,amount,total,payment_mode,is_cancelled"
        ok_body = body.lstrip().startswith(expected_header)
        log("GET /reports/transactions?type=sale&format=csv -> 200", ok_status, f"status={r.status_code}")
        log("Content-Type is text/csv", ok_ct, f"got={ct!r}")
        log("Content-Disposition has attachment+transactions_*.csv", ok_cd, f"got={cd!r}")
        log("CSV body starts with expected header line", ok_body, f"first160={body[:160]!r}")
    except Exception as e:
        log("GET /reports/transactions csv (sale)", False, str(e))

    # ========================================================================
    # 3) /api/reports/transactions?type=purchase&format=csv
    # ========================================================================
    try:
        r = requests.get(f"{API}/reports/transactions", params={"type": "purchase", "format": "csv"}, headers=H, timeout=30)
        ok_status = r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        cd = r.headers.get("Content-Disposition", "")
        body = r.text
        expected_header = "date,time,type,reference,person_name,outlet,product,variety,quantity,rate,amount,total,payment_mode,is_cancelled"
        ok_body = body.lstrip().startswith(expected_header)
        log("GET /reports/transactions?type=purchase&format=csv -> 200", ok_status, f"status={r.status_code}")
        log("Purchase CSV Content-Type & Disposition correct",
            ("text/csv" in ct.lower()) and ("attachment" in cd.lower()) and ("transactions_" in cd),
            f"ct={ct!r} cd={cd!r}")
        log("Purchase CSV body starts with expected header (may be empty thereafter)", ok_body,
            f"first160={body[:160]!r}")
    except Exception as e:
        log("GET /reports/transactions csv (purchase)", False, str(e))

    # ========================================================================
    # 4) /api/reports/transactions?customer_id=<existing>
    # ========================================================================
    if sample_customer_id:
        try:
            r = requests.get(f"{API}/reports/transactions",
                             params={"customer_id": sample_customer_id, "format": "json"},
                             headers=H, timeout=30)
            ok_status = r.status_code == 200
            body = r.json() if ok_status else {}
            rows = body.get("rows", [])
            # Every Sale row should be that customer's; Purchases may also be present (no customer filter applied to purchases) — but main agent's intent is customer's sales.
            sale_rows = [row for row in rows if row.get("type") == "Sale"]
            non_sale = [row for row in rows if row.get("type") != "Sale"]
            log(f"GET /reports/transactions?customer_id={sample_customer_id} -> 200", ok_status,
                f"status={r.status_code}, total_rows={len(rows)}, sale_rows={len(sale_rows)}, non_sale={len(non_sale)}")
            # we at least expect non-empty sale_rows (since the customer was picked from a sale)
            log("customer_id filter returns at least one Sale row", len(sale_rows) >= 1)
        except Exception as e:
            log("GET /reports/transactions?customer_id=...", False, str(e))
    else:
        log("GET /reports/transactions?customer_id=... (skipped — no existing customer with sales found)", True)

    # ========================================================================
    # 5) /api/reports/raw?type=sale&format=csv (admin only)
    # ========================================================================
    try:
        r = requests.get(f"{API}/reports/raw", params={"type": "sale", "format": "csv"}, headers=H, timeout=30)
        ok_status = r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        cd = r.headers.get("Content-Disposition", "")
        ok_ct = "text/csv" in ct.lower()
        ok_cd = ("attachment" in cd.lower()) and ("raw_sale_" in cd) and (cd.strip().endswith(".csv"))
        body = r.text
        log("GET /reports/raw?type=sale&format=csv -> 200", ok_status, f"status={r.status_code}")
        log("Raw CSV Content-Type is text/csv", ok_ct, f"got={ct!r}")
        log("Raw CSV Content-Disposition raw_sale_*.csv", ok_cd, f"got={cd!r}")
        # body should at least have a header line (non-empty)
        log("Raw CSV body non-empty (has at least header)", len(body.strip()) > 0,
            f"len={len(body)}")
    except Exception as e:
        log("GET /reports/raw csv (admin)", False, str(e))

    # Optional: confirm non-admin gets 403. Try farmer if account exists.
    try:
        farmer_token = None
        try:
            farmer_token = login("ramu_farmer", "farmer123")
        except Exception:
            farmer_token = None
        if farmer_token:
            r = requests.get(f"{API}/reports/raw",
                             params={"type": "sale", "format": "csv"},
                             headers=auth_headers(farmer_token), timeout=30)
            log("GET /reports/raw with non-admin returns 403", r.status_code == 403,
                f"status={r.status_code}")
        else:
            log("GET /reports/raw non-admin 403 check (skipped — no farmer credentials work)", True)
    except Exception as e:
        log("GET /reports/raw non-admin 403 check", False, str(e))

    # ========================================================================
    # 6) /api/vendor-procurement (admin)
    # ========================================================================
    try:
        r = requests.get(f"{API}/vendor-procurement", headers=H, timeout=30)
        ok_status = r.status_code == 200
        body = r.json() if ok_status else []
        ok_list = isinstance(body, list)
        log("GET /vendor-procurement (admin) -> 200 returns list", ok_status and ok_list,
            f"status={r.status_code}, count={len(body) if ok_list else 'n/a'}")
    except Exception as e:
        log("GET /vendor-procurement admin", False, str(e))

    # 6b) include_deleted=false (default) excludes cancelled procurements
    try:
        r = requests.get(f"{API}/vendor-procurement",
                         params={"include_deleted": "false"}, headers=H, timeout=30)
        body = r.json() if r.status_code == 200 else []
        cancelled_count = sum(1 for p in body if p.get("is_deleted") is True)
        log("GET /vendor-procurement?include_deleted=false excludes cancelled",
            r.status_code == 200 and cancelled_count == 0,
            f"status={r.status_code}, cancelled_in_result={cancelled_count}")

        # Compare against include_deleted=true for sanity
        r2 = requests.get(f"{API}/vendor-procurement",
                          params={"include_deleted": "true"}, headers=H, timeout=30)
        all_body = r2.json() if r2.status_code == 200 else []
        total_cancelled = sum(1 for p in all_body if p.get("is_deleted") is True)
        log("Sanity: include_deleted=true may include cancelled rows",
            r2.status_code == 200,
            f"status={r2.status_code}, total={len(all_body)}, cancelled={total_cancelled}")
    except Exception as e:
        log("GET /vendor-procurement include_deleted check", False, str(e))

    # ========================================================================
    # 7) Regression: /api/search/global?q=a
    # ========================================================================
    try:
        r = requests.get(f"{API}/search/global", params={"q": "a"}, headers=H, timeout=30)
        ok_status = r.status_code == 200
        body = r.json() if ok_status else {}
        ok_struct = all(k in body for k in ("query", "customers", "vendors", "products", "sales", "outlets", "total"))
        log("GET /search/global?q=a -> 200 with expected keys", ok_status and ok_struct,
            f"status={r.status_code}, total={body.get('total') if ok_struct else 'n/a'}")
    except Exception as e:
        log("GET /search/global", False, str(e))

    # ========================================================================
    # 8) Regression: /api/customers/search?q=a
    # ========================================================================
    try:
        r = requests.get(f"{API}/customers/search", params={"q": "a"}, headers=H, timeout=30)
        ok_status = r.status_code == 200
        body = r.json() if ok_status else None
        ok_list = isinstance(body, list)
        log("GET /customers/search?q=a -> 200 returns list", ok_status and ok_list,
            f"status={r.status_code}, count={len(body) if ok_list else 'n/a'}")
    except Exception as e:
        log("GET /customers/search", False, str(e))

    # Summary
    print("\n" + "=" * 70)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"RESULT: {passed}/{total} checks passed")
    print("=" * 70)
    failed = [(n, m) for n, ok, m in results if not ok]
    if failed:
        print("FAILURES:")
        for name, msg in failed:
            print(f"  - {name}: {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
