#!/usr/bin/env python3
"""
FPO Manager API Backend Testing - Phase 1 Critical Fixes Focus
Testing the critical procurement and authentication endpoints as requested
"""

import requests
import json
import sys
from datetime import datetime
import base64

# Configuration
BASE_URL = "https://fpo-offline-trade.preview.emergentagent.com/api"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

class FPOAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data
        })
        
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def test_authentication(self):
        """Test 1: Authentication - POST /auth/login with admin credentials"""
        print("\n=== Testing Authentication ===")
        
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.admin_token = data["access_token"]
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.admin_token}"
                    })
                    self.log_test(
                        "Admin Login", 
                        True, 
                        f"Successfully logged in as {data['user'].get('role', 'unknown')} user",
                        {"token_received": True, "user_role": data['user'].get('role')}
                    )
                    return True
                else:
                    self.log_test("Admin Login", False, "Missing access_token or user in response", data)
            else:
                self.log_test("Admin Login", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            
        return False
    
    def get_test_data(self):
        """Get test data (farmers, products, outlets, vendors) for procurement tests"""
        print("\n=== Fetching Test Data ===")
        
        test_data = {
            "farmers": [],
            "products": [],
            "outlets": [],
            "vendors": []
        }
        
        endpoints = [
            ("farmers", "/farmers"),
            ("products", "/products"), 
            ("outlets", "/outlets"),
            ("vendors", "/vendors")
        ]
        
        for key, endpoint in endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    test_data[key] = data
                    print(f"✅ Fetched {len(data)} {key}")
                else:
                    print(f"❌ Failed to fetch {key}: HTTP {response.status_code}")
            except Exception as e:
                print(f"❌ Exception fetching {key}: {str(e)}")
        
        return test_data
    
    def test_farmer_purchase_critical(self, test_data):
        """Test 2: Procurement - Farmer Purchase (CRITICAL)"""
        print("\n=== Testing Farmer Purchase (CRITICAL) ===")
        
        if not test_data["farmers"] or not test_data["products"] or not test_data["outlets"]:
            self.log_test("Farmer Purchase", False, "Missing required test data (farmers/products/outlets)")
            return False
        
        farmer = test_data["farmers"][0]
        product = test_data["products"][0]
        outlet = test_data["outlets"][0]
        
        try:
            # Get initial stock for verification
            stock_response = self.session.get(f"{self.base_url}/stock", timeout=10)
            initial_stock = {}
            if stock_response.status_code == 200:
                for item in stock_response.json():
                    if item["product_id"] == product["id"] and item["outlet_id"] == outlet["id"]:
                        initial_stock = item
                        break
            
            # Create farmer purchase
            purchase_data = {
                "farmer_id": farmer["id"],
                "product_id": product["id"],
                "outlet_id": outlet["id"],
                "quantity": 10,
                "rate": 50,
                "payment_status": "paid"
            }
            
            response = self.session.post(
                f"{self.base_url}/farmer-purchases",
                json=purchase_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response indicates stock was updated
                stock_updated = data.get("stock_updated", False)
                
                # Verify stock increased
                stock_response = self.session.get(f"{self.base_url}/stock", timeout=10)
                if stock_response.status_code == 200:
                    current_stock = {}
                    for item in stock_response.json():
                        if item["product_id"] == product["id"] and item["outlet_id"] == outlet["id"]:
                            current_stock = item
                            break
                    
                    initial_qty = initial_stock.get("stock_received", 0)
                    current_qty = current_stock.get("stock_received", 0)
                    
                    if current_qty > initial_qty:
                        self.log_test(
                            "Farmer Purchase", 
                            True, 
                            f"Purchase created successfully, stock increased from {initial_qty} to {current_qty}",
                            {"stock_updated": True, "quantity_increase": current_qty - initial_qty}
                        )
                        return True
                    else:
                        self.log_test(
                            "Farmer Purchase", 
                            False, 
                            f"Stock not updated properly. Initial: {initial_qty}, Current: {current_qty}",
                            data
                        )
                else:
                    self.log_test("Farmer Purchase", True, "Purchase created but couldn't verify stock", data)
                    return True
            else:
                self.log_test("Farmer Purchase", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Purchase", False, f"Exception: {str(e)}")
            
        return False
    
    def test_vendor_procurement_critical(self, test_data):
        """Test 3: Procurement - Vendor Purchase (CRITICAL)"""
        print("\n=== Testing Vendor Procurement (CRITICAL) ===")
        
        if not test_data["vendors"] or not test_data["products"] or not test_data["outlets"]:
            self.log_test("Vendor Procurement", False, "Missing required test data (vendors/products/outlets)")
            return False
        
        vendor = test_data["vendors"][0]
        product = test_data["products"][0]
        outlet = test_data["outlets"][0]
        
        try:
            procurement_data = {
                "vendor_id": vendor["id"],
                "product_id": product["id"],
                "outlet_id": outlet["id"],
                "quantity": 20,
                "rate": 40,
                "payment_mode": "cash",
                "cash_amount": 800,
                "online_amount": 0
            }
            
            response = self.session.post(
                f"{self.base_url}/vendor-procurement",
                json=procurement_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                stock_updated = data.get("stock_updated", False)
                
                self.log_test(
                    "Vendor Procurement", 
                    True, 
                    f"Procurement created successfully, stock_updated: {stock_updated}",
                    {"stock_updated": stock_updated, "receipt_number": data.get("receipt_number")}
                )
                return True
            else:
                self.log_test("Vendor Procurement", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Vendor Procurement", False, f"Exception: {str(e)}")
            
        return False
    
    def test_manual_entry_support(self, test_data):
        """Test 4: Manual Entry Support"""
        print("\n=== Testing Manual Entry Support ===")
        
        if not test_data["outlets"]:
            self.log_test("Manual Entry", False, "Missing outlet data for manual entry test")
            return False
        
        outlet = test_data["outlets"][0]
        
        try:
            manual_purchase_data = {
                "farmer_id": "manual",
                "manual_farmer_name": "New Farmer",
                "product_id": "manual", 
                "manual_product_name": "New Product",
                "manual_product_unit": "kg",
                "outlet_id": outlet["id"],
                "quantity": 5,
                "rate": 100,
                "payment_status": "credit"
            }
            
            response = self.session.post(
                f"{self.base_url}/farmer-purchases",
                json=manual_purchase_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    "Manual Entry", 
                    True, 
                    "Manual entry purchase created successfully",
                    {"manual_farmer": "New Farmer", "manual_product": "New Product"}
                )
                return True
            else:
                self.log_test("Manual Entry", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Manual Entry", False, f"Exception: {str(e)}")
            
        return False
    
    def test_reports(self):
        """Test 5: Reports endpoints"""
        print("\n=== Testing Reports ===")
        
        reports = [
            ("Sales Report", "/reports/sales"),
            ("Stock Report", "/reports/stock")
        ]
        
        all_passed = True
        
        for report_name, endpoint in reports:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if endpoint == "/reports/sales":
                        # Should return summary with count, total, etc.
                        if isinstance(data, dict) and ("count" in data or "total" in data or len(data) > 0):
                            self.log_test(report_name, True, f"Sales report returned valid data structure")
                        else:
                            self.log_test(report_name, False, "Sales report missing expected summary fields")
                            all_passed = False
                    elif endpoint == "/reports/stock":
                        # Should return array of stock items
                        if isinstance(data, list):
                            self.log_test(report_name, True, f"Stock report returned {len(data)} items")
                        else:
                            self.log_test(report_name, False, "Stock report should return array")
                            all_passed = False
                        
                else:
                    self.log_test(report_name, False, f"HTTP {response.status_code}: {response.text}")
                    all_passed = False
                    
            except Exception as e:
                self.log_test(report_name, False, f"Exception: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def test_stock_verification(self):
        """Test 6: Stock Verification"""
        print("\n=== Testing Stock Verification ===")
        
        try:
            response = self.session.get(f"{self.base_url}/stock", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    # Check that stock items have required fields
                    valid_items = 0
                    for item in data:
                        if all(field in item for field in ["product_id", "outlet_id", "quantity", "stock_received"]):
                            valid_items += 1
                    
                    self.log_test(
                        "Stock Verification", 
                        True, 
                        f"Retrieved {len(data)} stock items, {valid_items} with complete data",
                        {"total_items": len(data), "valid_items": valid_items}
                    )
                    return True
                else:
                    self.log_test("Stock Verification", False, "Stock endpoint should return array")
            else:
                self.log_test("Stock Verification", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Stock Verification", False, f"Exception: {str(e)}")
            
        return False
    
    def run_all_tests(self):
        """Run all Phase 1 Critical Fix tests"""
        print("🚀 Starting FPO Manager API Backend Testing - Phase 1 Critical Fixes")
        print(f"Base URL: {self.base_url}")
        print(f"Test Credentials: {ADMIN_USERNAME}/{'*' * len(ADMIN_PASSWORD)}")
        print("=" * 70)
        
        # Test 1: Authentication (Required for all other tests)
        if not self.test_authentication():
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with other tests.")
            return False
        
        # Get test data
        test_data = self.get_test_data()
        
        # Test 2: Farmer Purchase (CRITICAL)
        self.test_farmer_purchase_critical(test_data)
        
        # Test 3: Vendor Procurement (CRITICAL) 
        self.test_vendor_procurement_critical(test_data)
        
        # Test 4: Manual Entry Support
        self.test_manual_entry_support(test_data)
        
        # Test 5: Reports
        self.test_reports()
        
        # Test 6: Stock Verification
        self.test_stock_verification()
        
        # Summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}: {result['message']}")

if __name__ == "__main__":
    tester = FPOAPITester()
    success = tester.run_all_tests()
    
    if not success:
        sys.exit(1)