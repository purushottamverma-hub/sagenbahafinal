#!/usr/bin/env python3
"""
Backend tests for Reports CSV endpoints:
  - GET /api/reports/transactions
  - GET /api/reports/raw

Plus a quick regression check for /api/customers/search and /api/vendor-procurement.

Read-only verification preferred. No live data is mutated.
"""

import csv
import io
import os
import sys
import uuid

import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://transaction-mgmt-dev.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

results = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")
    results.append((name, ok, detail))


def admin_login():
    r = requests.post(
        f"{API}/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    return token


def register_farmer_and_login():
    """Register a temp farmer (auto-active, gets token). Used for non-admin 403 test."""
    suffix = uuid.uuid4().hex[:8]
    username = f"farmer_test_{suffix}"
    password = "farmer_test_pass_123"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "username": username,
            "password": password,
            "full_name": f"TEST_{suffix} Ramesh",
            "role": "farmer",
            "mobile": "9000000000",
            "village": "TestVillage",
        },
        timeout=30,
    )
    if r.status_code != 200:
        print(f"  (Could not register farmer: {r.status_code} {r.text})")
        return None
    body = r.json()
    return body.get("access_token")


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def parse_csv_text(text):
    reader = csv.reader(io.StringIO(text))
    return list(reader)


# ============================================================
# /api/reports/transactions
# ============================================================

def test_transactions_json_all(admin_token):
    r = requests.get(
        f"{API}/reports/transactions",
        params={"format": "json", "type": "all"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        body = r.json()
        if not isinstance(body, dict) or "count" not in body or "rows" not in body:
            ok = False
            detail += " - missing count/rows keys"
        else:
            expected_keys = {"date", "time", "type", "reference", "person_name", "outlet",
                             "product", "variety", "quantity", "rate", "amount", "total",
                             "payment_mode", "is_cancelled"}
            if body["rows"]:
                row_keys = set(body["rows"][0].keys())
                missing = expected_keys - row_keys
                if missing:
                    ok = False
                    detail += f" - missing row keys: {missing}"
                else:
                    detail += f" - count={body['count']}, sample type={body['rows'][0].get('type')}"
            else:
                detail += f" - count={body['count']} (empty)"
    record("1a) /reports/transactions format=json type=all", ok, detail)
    return ok


def test_transactions_csv_all(admin_token):
    r = requests.get(
        f"{API}/reports/transactions",
        params={"format": "csv", "type": "all"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        ct = r.headers.get("Content-Type", "")
        cd = r.headers.get("Content-Disposition", "")
        if not ct.lower().startswith("text/csv"):
            ok = False
            detail += f" - wrong Content-Type: {ct}"
        elif "attachment" not in cd or "filename" not in cd:
            ok = False
            detail += f" - missing Content-Disposition: {cd}"
        else:
            rows = parse_csv_text(r.text)
            header = rows[0] if rows else []
            expected = ["date", "time", "type", "reference", "person_name", "outlet",
                        "product", "variety", "quantity", "rate", "amount", "total",
                        "payment_mode", "is_cancelled"]
            if header != expected:
                ok = False
                detail += f" - header mismatch: got {header}"
            else:
                detail += f" - CT={ct.split(';')[0]}, data_rows={len(rows)-1}"
    record("1b) /reports/transactions format=csv type=all", ok, detail)
    return ok


def test_transactions_csv_sale_only(admin_token):
    r = requests.get(
        f"{API}/reports/transactions",
        params={"format": "csv", "type": "sale",
                "start_date": "2020-01-01", "end_date": "2030-12-31"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        rows = parse_csv_text(r.text)
        header = rows[0] if rows else []
        type_idx = header.index("type") if "type" in header else -1
        if type_idx < 0:
            ok = False
            detail += " - no 'type' column"
        else:
            non_sale = [row for row in rows[1:] if row and row[type_idx] != "Sale"]
            if non_sale:
                ok = False
                detail += f" - {len(non_sale)} non-Sale rows; sample={non_sale[0][:5]}"
            else:
                detail += f" - {len(rows)-1} rows, all type=Sale"
    record("1c) /reports/transactions type=sale (wide range) - all 'Sale'", ok, detail)
    return ok


def test_transactions_csv_purchase_only(admin_token):
    r = requests.get(
        f"{API}/reports/transactions",
        params={"format": "csv", "type": "purchase",
                "start_date": "2020-01-01", "end_date": "2030-12-31"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        rows = parse_csv_text(r.text)
        header = rows[0] if rows else []
        type_idx = header.index("type") if "type" in header else -1
        if type_idx < 0:
            ok = False
            detail += " - no 'type' column"
        else:
            non_purchase = [row for row in rows[1:] if row and row[type_idx] != "Purchase"]
            if non_purchase:
                ok = False
                detail += f" - {len(non_purchase)} non-Purchase rows; sample={non_purchase[0][:5]}"
            else:
                detail += f" - {len(rows)-1} rows, all type=Purchase"
    record("1d) /reports/transactions type=purchase - all 'Purchase'", ok, detail)
    return ok


def test_transactions_include_deleted(admin_token):
    r1 = requests.get(
        f"{API}/reports/transactions",
        params={"format": "json", "type": "all",
                "start_date": "2020-01-01", "end_date": "2030-12-31",
                "include_deleted": "false"},
        headers=hdr(admin_token), timeout=60,
    )
    r2 = requests.get(
        f"{API}/reports/transactions",
        params={"format": "json", "type": "all",
                "start_date": "2020-01-01", "end_date": "2030-12-31",
                "include_deleted": "true"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r1.status_code == 200 and r2.status_code == 200
    detail = f"HTTP {r1.status_code}/{r2.status_code}"
    if ok:
        c1 = r1.json().get("count", 0)
        c2 = r2.json().get("count", 0)
        cancelled_in_default = [row for row in r1.json().get("rows", []) if row.get("is_cancelled")]
        cancelled_in_with = [row for row in r2.json().get("rows", []) if row.get("is_cancelled")]
        if c2 < c1:
            ok = False
            detail += f" - include_deleted=true count {c2} < default {c1}"
        elif cancelled_in_default:
            ok = False
            detail += f" - default leaked {len(cancelled_in_default)} cancelled rows"
        else:
            detail += f" - default={c1}, with_deleted={c2}, cancelled_only_with_deleted={len(cancelled_in_with)}"
    record("1e) /reports/transactions include_deleted toggle", ok, detail)
    return ok


def test_transactions_date_filter_narrows(admin_token):
    r = requests.get(
        f"{API}/reports/transactions",
        params={"format": "csv", "type": "all",
                "start_date": "1990-01-01", "end_date": "1990-12-31"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        rows = parse_csv_text(r.text)
        non_header_rows = [row for row in rows[1:] if row]
        if len(non_header_rows) != 0:
            ok = False
            detail += f" - expected 0 data rows, got {len(non_header_rows)}"
        else:
            detail += " - 0 data rows beyond header"
    record("1f) /reports/transactions date filter (1990) → 0 rows", ok, detail)
    return ok


# ============================================================
# /api/reports/raw
# ============================================================

def test_raw_sales_csv(admin_token):
    r = requests.get(
        f"{API}/reports/raw",
        params={"type": "sale", "format": "csv"},
        headers=hdr(admin_token), timeout=90,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        ct = r.headers.get("Content-Type", "")
        if not ct.lower().startswith("text/csv"):
            ok = False
            detail += f" - wrong Content-Type: {ct}"
        else:
            rows = parse_csv_text(r.text)
            if len(rows) < 1:
                ok = False
                detail += " - no header"
            else:
                header = set(rows[0])
                must_have_any = {"id", "bill_number", "items"}
                hits = must_have_any & header
                if not hits:
                    ok = False
                    detail += f" - header missing sales keys; cols sample={sorted(header)[:10]}"
                else:
                    detail += f" - data_rows={len(rows)-1}, header_cols={len(header)}, has {sorted(hits)}"
    record("2a) /reports/raw type=sale&format=csv (admin)", ok, detail)
    return ok


def test_raw_purchase_csv(admin_token):
    r = requests.get(
        f"{API}/reports/raw",
        params={"type": "purchase", "format": "csv"},
        headers=hdr(admin_token), timeout=90,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        rows = parse_csv_text(r.text)
        if len(rows) < 1:
            ok = False
            detail += " - no header"
        else:
            header = set(rows[0])
            must_have_any = {"id", "receipt_number", "vendor_id"}
            hits = must_have_any & header
            if not hits:
                ok = False
                detail += f" - header missing procurement keys; cols sample={sorted(header)[:10]}"
            else:
                detail += f" - data_rows={len(rows)-1}, header_cols={len(header)}, has {sorted(hits)}"
    record("2b) /reports/raw type=purchase&format=csv (admin)", ok, detail)
    return ok


def test_raw_sales_json(admin_token):
    r = requests.get(
        f"{API}/reports/raw",
        params={"type": "sale", "format": "json"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        body = r.json()
        if not isinstance(body, dict) or "count" not in body or "rows" not in body:
            ok = False
            detail += " - missing count/rows"
        else:
            detail += f" - count={body['count']}, rows_len={len(body['rows'])}"
    record("2c) /reports/raw type=sale&format=json (admin)", ok, detail)
    return ok


def test_raw_non_admin_forbidden(non_admin_token):
    if not non_admin_token:
        record("2d) /reports/raw non-admin → 403", False, "couldn't create non-admin user")
        return False
    r = requests.get(
        f"{API}/reports/raw",
        params={"type": "sale", "format": "csv"},
        headers=hdr(non_admin_token), timeout=30,
    )
    ok = r.status_code == 403
    detail = f"HTTP {r.status_code}"
    if not ok:
        detail += f" - expected 403, body={r.text[:120]}"
    record("2d) /reports/raw non-admin (farmer token) → 403", ok, detail)
    return ok


def test_raw_future_date_zero_rows(admin_token):
    r = requests.get(
        f"{API}/reports/raw",
        params={"type": "sale", "format": "json",
                "start_date": "2099-01-01", "end_date": "2099-12-31"},
        headers=hdr(admin_token), timeout=60,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        cnt = r.json().get("count", -1)
        if cnt != 0:
            ok = False
            detail += f" - expected count=0, got {cnt}"
        else:
            detail += " - count=0"
    record("2e) /reports/raw future date range → 0 rows", ok, detail)
    return ok


# ============================================================
# Regression
# ============================================================

def test_customers_search(admin_token):
    r = requests.get(
        f"{API}/customers/search",
        params={"q": "ram"},
        headers=hdr(admin_token), timeout=30,
    )
    ok = r.status_code == 200 and isinstance(r.json(), list)
    detail = f"HTTP {r.status_code}, len={len(r.json()) if ok else 'n/a'}"
    record("3a) /customers/search?q=ram", ok, detail)
    return ok


def test_vendor_procurement_get(admin_token):
    r = requests.get(
        f"{API}/vendor-procurement",
        headers=hdr(admin_token), timeout=30,
    )
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        body = r.json()
        detail += f", len={len(body) if isinstance(body, list) else 'not_list'}"
    record("3b) /vendor-procurement (GET)", ok, detail)
    return ok


# ============================================================
# Main
# ============================================================

def main():
    print(f"Base API: {API}")
    admin_token = admin_login()
    print(f"Admin login OK, token len={len(admin_token)}")

    test_transactions_json_all(admin_token)
    test_transactions_csv_all(admin_token)
    test_transactions_csv_sale_only(admin_token)
    test_transactions_csv_purchase_only(admin_token)
    test_transactions_include_deleted(admin_token)
    test_transactions_date_filter_narrows(admin_token)

    test_raw_sales_csv(admin_token)
    test_raw_purchase_csv(admin_token)
    test_raw_sales_json(admin_token)
    non_admin_token = register_farmer_and_login()
    test_raw_non_admin_forbidden(non_admin_token)
    test_raw_future_date_zero_rows(admin_token)

    test_customers_search(admin_token)
    test_vendor_procurement_get(admin_token)

    print("\n=== SUMMARY ===")
    pass_n = sum(1 for _, ok, _ in results if ok)
    fail_n = len(results) - pass_n
    print(f"Total: {len(results)}, Pass: {pass_n}, Fail: {fail_n}")
    for name, ok, detail in results:
        print(f"  {'OK' if ok else 'FAIL'}: {name}  ::  {detail}")
    sys.exit(0 if fail_n == 0 else 1)


if __name__ == "__main__":
    main()
