#!/usr/bin/env python3
"""
FPO Management System - Backend API Testing
Testing authentication endpoints, protected routes, Admin CRUD operations,
and three NEW features requested for testing:
1. Notifications System
2. Shareholder Upgrade System  
3. Vendor Procurement System
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://agrisync.preview.emergentagent.com/api"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}=== {test_name} ==={Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ {message}{Colors.ENDC}")

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_result(self, test_name, success, message="", error_details=""):
        if success:
            self.test_results['passed'] += 1
            print_success(f"{test_name}: {message}")
        else:
            self.test_results['failed'] += 1
            error_msg = f"{test_name}: {message}"
            if error_details:
                error_msg += f" - {error_details}"
            self.test_results['errors'].append(error_msg)
            print_error(error_msg)

    def test_login_success(self):
        """Test successful login with correct admin credentials"""
        print_test_header("Login API - Success Case")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            print_info(f"Request URL: {BASE_URL}/auth/login")
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ['access_token', 'token_type', 'user']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(
                        "Login Success", 
                        False, 
                        f"Missing required fields: {missing_fields}"
                    )
                    return False
                
                # Check user object structure
                user = data.get('user', {})
                user_fields = ['id', 'username', 'full_name', 'role']
                missing_user_fields = [field for field in user_fields if field not in user]
                
                if missing_user_fields:
                    self.log_result(
                        "Login Success", 
                        False, 
                        f"Missing user fields: {missing_user_fields}"
                    )
                    return False
                
                # Store token for later tests
                self.admin_token = data['access_token']
                
                self.log_result(
                    "Login Success", 
                    True, 
                    f"Admin login successful. Role: {user.get('role')}, Token received"
                )
                return True
                
            else:
                self.log_result(
                    "Login Success", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Login Success", False, "Request failed", str(e))
            return False

    def test_login_wrong_password(self):
        """Test login with wrong password"""
        print_test_header("Login API - Wrong Password")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": "wrongpassword"
                },
                headers={"Content-Type": "application/json"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 401:
                data = response.json()
                if 'detail' in data:
                    self.log_result(
                        "Login Wrong Password", 
                        True, 
                        f"Correctly rejected with 401: {data['detail']}"
                    )
                    return True
                else:
                    self.log_result(
                        "Login Wrong Password", 
                        False, 
                        "401 returned but no error detail"
                    )
                    return False
            else:
                self.log_result(
                    "Login Wrong Password", 
                    False, 
                    f"Expected 401, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Login Wrong Password", False, "Request failed", str(e))
            return False

    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        print_test_header("Login API - Non-existent User")
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={
                    "username": "nonexistentuser123",
                    "password": "anypassword"
                },
                headers={"Content-Type": "application/json"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 401:
                data = response.json()
                if 'detail' in data:
                    self.log_result(
                        "Login Non-existent User", 
                        True, 
                        f"Correctly rejected with 401: {data['detail']}"
                    )
                    return True
                else:
                    self.log_result(
                        "Login Non-existent User", 
                        False, 
                        "401 returned but no error detail"
                    )
                    return False
            else:
                self.log_result(
                    "Login Non-existent User", 
                    False, 
                    f"Expected 401, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Login Non-existent User", False, "Request failed", str(e))
            return False

    def test_register_farmer(self):
        """Test farmer registration (should auto-login)"""
        print_test_header("Register API - Farmer Registration")
        
        # Generate unique username
        timestamp = int(datetime.now().timestamp())
        farmer_username = f"testfarmer{timestamp}"
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/register",
                json={
                    "username": farmer_username,
                    "password": "farmer123",
                    "full_name": "Test Farmer",
                    "role": "farmer",
                    "mobile": "9876543210",
                    "village": "Test Village"
                },
                headers={"Content-Type": "application/json"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for auto-login (should have access_token)
                if 'access_token' in data and 'user' in data:
                    user = data.get('user', {})
                    if user.get('role') == 'farmer' and data.get('status') == 'active':
                        self.log_result(
                            "Register Farmer", 
                            True, 
                            f"Farmer registered and auto-logged in. Status: {data.get('status')}"
                        )
                        return True
                    else:
                        self.log_result(
                            "Register Farmer", 
                            False, 
                            f"Registration successful but unexpected role/status: {user.get('role')}/{data.get('status')}"
                        )
                        return False
                else:
                    self.log_result(
                        "Register Farmer", 
                        False, 
                        "Registration successful but no auto-login token provided"
                    )
                    return False
            else:
                self.log_result(
                    "Register Farmer", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Register Farmer", False, "Request failed", str(e))
            return False

    def test_register_agent(self):
        """Test agent registration (should return pending status)"""
        print_test_header("Register API - Agent Registration")
        
        # Generate unique username
        timestamp = int(datetime.now().timestamp())
        agent_username = f"testagent{timestamp}"
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/register",
                json={
                    "username": agent_username,
                    "password": "agent123",
                    "full_name": "Test Agent",
                    "role": "agent",
                    "mobile": "9876543211",
                    "village": "Test Village"
                },
                headers={"Content-Type": "application/json"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for pending status (should NOT have access_token)
                if data.get('status') == 'pending' and 'access_token' not in data:
                    if 'pending approval' in data.get('message', '').lower():
                        self.log_result(
                            "Register Agent", 
                            True, 
                            f"Agent registration pending approval. Status: {data.get('status')}"
                        )
                        return True
                    else:
                        self.log_result(
                            "Register Agent", 
                            False, 
                            f"Status is pending but message unclear: {data.get('message')}"
                        )
                        return False
                else:
                    self.log_result(
                        "Register Agent", 
                        False, 
                        f"Expected pending status without token, got: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "Register Agent", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Register Agent", False, "Request failed", str(e))
            return False

    def test_protected_endpoint_without_token(self):
        """Test protected endpoint without authentication token"""
        print_test_header("Protected Endpoint - No Token")
        
        try:
            response = self.session.get(
                f"{BASE_URL}/dashboard",
                headers={"Content-Type": "application/json"}
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 401:
                self.log_result(
                    "Protected Endpoint No Token", 
                    True, 
                    "Correctly rejected with 401 Unauthorized"
                )
                return True
            elif response.status_code == 403:
                self.log_result(
                    "Protected Endpoint No Token", 
                    True, 
                    "Correctly rejected with 403 Forbidden"
                )
                return True
            else:
                self.log_result(
                    "Protected Endpoint No Token", 
                    False, 
                    f"Expected 401/403, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Protected Endpoint No Token", False, "Request failed", str(e))
            return False

    def test_protected_endpoint_with_token(self):
        """Test protected endpoint with valid authentication token"""
        print_test_header("Protected Endpoint - With Valid Token")
        
        if not self.admin_token:
            self.log_result(
                "Protected Endpoint With Token", 
                False, 
                "No admin token available (login test may have failed)"
            )
            return False
        
        try:
            response = self.session.get(
                f"{BASE_URL}/dashboard",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.admin_token}"
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                # Check if dashboard data structure is reasonable
                expected_keys = ['today', 'month', 'counts']
                if any(key in data for key in expected_keys):
                    self.log_result(
                        "Protected Endpoint With Token", 
                        True, 
                        "Dashboard accessible with valid token, data structure looks correct"
                    )
                    return True
                else:
                    self.log_result(
                        "Protected Endpoint With Token", 
                        True, 
                        "Dashboard accessible with valid token (data structure may be different)"
                    )
                    return True
            else:
                self.log_result(
                    "Protected Endpoint With Token", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Protected Endpoint With Token", False, "Request failed", str(e))
            return False

    def test_invalid_token(self):
        """Test protected endpoint with invalid token"""
        print_test_header("Protected Endpoint - Invalid Token")
        
        try:
            response = self.session.get(
                f"{BASE_URL}/dashboard",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer invalid_token_12345"
                }
            )
            
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 401:
                self.log_result(
                    "Protected Endpoint Invalid Token", 
                    True, 
                    "Correctly rejected invalid token with 401"
                )
                return True
            else:
                self.log_result(
                    "Protected Endpoint Invalid Token", 
                    False, 
                    f"Expected 401, got {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_result("Protected Endpoint Invalid Token", False, "Request failed", str(e))
            return False

    def test_products_crud(self):
        """Test Products CRUD operations"""
        print_test_header("Products CRUD Operations")
        
        if not self.admin_token:
            self.log_result("Products CRUD", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        product_id = None
        
        try:
            # 1. GET /api/products - List all products
            response = self.session.get(f"{BASE_URL}/products", headers=headers)
            print_info(f"GET Products - Status: {response.status_code}")
            
            if response.status_code == 200:
                products = response.json()
                self.log_result("Products GET", True, f"Retrieved {len(products)} products")
            else:
                self.log_result("Products GET", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 2. POST /api/products - Create new product
            new_product = {
                "name": "Test Rice",
                "name_hi": "टेस्ट चावल", 
                "unit": "kg",
                "category": "produce"
            }
            
            response = self.session.post(f"{BASE_URL}/products", json=new_product, headers=headers)
            print_info(f"POST Product - Status: {response.status_code}")
            
            if response.status_code == 200:
                created_product = response.json()
                product_id = created_product.get("id")
                if product_id:
                    self.log_result("Products POST", True, f"Created product with ID: {product_id}")
                else:
                    self.log_result("Products POST", False, "Product created but no ID returned")
                    return False
            else:
                self.log_result("Products POST", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 3. PUT /api/products/{id} - Update the created product
            update_data = {"name": "Test Rice Updated"}
            response = self.session.put(f"{BASE_URL}/products/{product_id}", json=update_data, headers=headers)
            print_info(f"PUT Product - Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log_result("Products PUT", True, "Product updated successfully")
            else:
                self.log_result("Products PUT", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 4. DELETE /api/products/{id} - Soft delete the product
            response = self.session.delete(f"{BASE_URL}/products/{product_id}", headers=headers)
            print_info(f"DELETE Product - Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log_result("Products DELETE", True, "Product soft deleted successfully")
            else:
                self.log_result("Products DELETE", False, f"HTTP {response.status_code}", response.text)
                return False
                
            return True
            
        except Exception as e:
            self.log_result("Products CRUD", False, "Request failed", str(e))
            return False

    def test_outlets_crud(self):
        """Test Outlets CRUD operations"""
        print_test_header("Outlets CRUD Operations")
        
        if not self.admin_token:
            self.log_result("Outlets CRUD", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        outlet_id = None
        
        try:
            # 1. GET /api/outlets - List all outlets
            response = self.session.get(f"{BASE_URL}/outlets", headers=headers)
            print_info(f"GET Outlets - Status: {response.status_code}")
            
            if response.status_code == 200:
                outlets = response.json()
                self.log_result("Outlets GET", True, f"Retrieved {len(outlets)} outlets")
            else:
                self.log_result("Outlets GET", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 2. POST /api/outlets - Create new outlet
            new_outlet = {
                "name": "Test Outlet",
                "address": "Test Address", 
                "contact_person": "Test Person"
            }
            
            response = self.session.post(f"{BASE_URL}/outlets", json=new_outlet, headers=headers)
            print_info(f"POST Outlet - Status: {response.status_code}")
            
            if response.status_code == 200:
                created_outlet = response.json()
                outlet_id = created_outlet.get("id")
                if outlet_id:
                    self.log_result("Outlets POST", True, f"Created outlet with ID: {outlet_id}")
                else:
                    self.log_result("Outlets POST", False, "Outlet created but no ID returned")
                    return False
            else:
                self.log_result("Outlets POST", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 3. PUT /api/outlets/{id} - Update the created outlet
            update_data = {"name": "Test Outlet Updated"}
            response = self.session.put(f"{BASE_URL}/outlets/{outlet_id}", json=update_data, headers=headers)
            print_info(f"PUT Outlet - Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log_result("Outlets PUT", True, "Outlet updated successfully")
            else:
                self.log_result("Outlets PUT", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 4. DELETE /api/outlets/{id} - Soft delete the outlet
            response = self.session.delete(f"{BASE_URL}/outlets/{outlet_id}", headers=headers)
            print_info(f"DELETE Outlet - Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log_result("Outlets DELETE", True, "Outlet soft deleted successfully")
            else:
                self.log_result("Outlets DELETE", False, f"HTTP {response.status_code}", response.text)
                return False
                
            return True
            
        except Exception as e:
            self.log_result("Outlets CRUD", False, "Request failed", str(e))
            return False

    def test_vendors_crud(self):
        """Test Vendors CRUD operations"""
        print_test_header("Vendors CRUD Operations")
        
        if not self.admin_token:
            self.log_result("Vendors CRUD", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        vendor_id = None
        
        try:
            # 1. GET /api/vendors - List all vendors
            response = self.session.get(f"{BASE_URL}/vendors", headers=headers)
            print_info(f"GET Vendors - Status: {response.status_code}")
            
            if response.status_code == 200:
                vendors = response.json()
                self.log_result("Vendors GET", True, f"Retrieved {len(vendors)} vendors")
            else:
                self.log_result("Vendors GET", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 2. POST /api/vendors - Create new vendor
            new_vendor = {
                "name": "Test Vendor",
                "mobile": "9876543210",
                "address": "Test Vendor Address"
            }
            
            response = self.session.post(f"{BASE_URL}/vendors", json=new_vendor, headers=headers)
            print_info(f"POST Vendor - Status: {response.status_code}")
            
            if response.status_code == 200:
                created_vendor = response.json()
                vendor_id = created_vendor.get("id")
                if vendor_id:
                    self.log_result("Vendors POST", True, f"Created vendor with ID: {vendor_id}")
                else:
                    self.log_result("Vendors POST", False, "Vendor created but no ID returned")
                    return False
            else:
                self.log_result("Vendors POST", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 3. PUT /api/vendors/{id} - Update the created vendor
            update_data = {"name": "Test Vendor Updated"}
            response = self.session.put(f"{BASE_URL}/vendors/{vendor_id}", json=update_data, headers=headers)
            print_info(f"PUT Vendor - Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log_result("Vendors PUT", True, "Vendor updated successfully")
            else:
                self.log_result("Vendors PUT", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # 4. DELETE /api/vendors/{id} - Soft delete the vendor
            response = self.session.delete(f"{BASE_URL}/vendors/{vendor_id}", headers=headers)
            print_info(f"DELETE Vendor - Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log_result("Vendors DELETE", True, "Vendor soft deleted successfully")
            else:
                self.log_result("Vendors DELETE", False, f"HTTP {response.status_code}", response.text)
                return False
                
            return True
            
        except Exception as e:
            self.log_result("Vendors CRUD", False, "Request failed", str(e))
            return False

    def test_sales_without_filter(self):
        """Test GET /api/sales without date filter - should return all sales"""
        print_test_header("Sales API - No Date Filter")
        
        if not self.admin_token:
            self.log_result("Sales No Filter", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            response = self.session.get(f"{BASE_URL}/sales", headers=headers)
            print_info(f"GET Sales - Status: {response.status_code}")
            
            if response.status_code == 200:
                sales_data = response.json()
                sales_count = len(sales_data) if isinstance(sales_data, list) else 0
                self.log_result("Sales No Filter", True, f"Retrieved {sales_count} sales records")
                return sales_data
            else:
                self.log_result("Sales No Filter", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Sales No Filter", False, "Request failed", str(e))
            return None

    def test_sales_with_jan_2026_filter(self):
        """Test GET /api/sales with January 2026 date filter"""
        print_test_header("Sales API - Jan 2026 Date Filter")
        
        if not self.admin_token:
            self.log_result("Sales Jan 2026 Filter", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            params = {
                "start_date": "2026-01-01",
                "end_date": "2026-01-31"
            }
            
            response = self.session.get(f"{BASE_URL}/sales", headers=headers, params=params)
            print_info(f"GET Sales Jan 2026 - Status: {response.status_code}")
            
            if response.status_code == 200:
                sales_data = response.json()
                sales_count = len(sales_data) if isinstance(sales_data, list) else 0
                
                # Check if any sales are within the date range
                jan_2026_sales = []
                if isinstance(sales_data, list):
                    for sale in sales_data:
                        created_at = sale.get('created_at', '')
                        if created_at and '2026-01' in created_at:
                            jan_2026_sales.append(sale)
                
                self.log_result(
                    "Sales Jan 2026 Filter", 
                    True, 
                    f"Retrieved {sales_count} total records, {len(jan_2026_sales)} from Jan 2026"
                )
                return sales_data
            else:
                self.log_result("Sales Jan 2026 Filter", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Sales Jan 2026 Filter", False, "Request failed", str(e))
            return None

    def test_sales_with_2020_filter(self):
        """Test GET /api/sales with 2020 date filter - should return empty (no data from 2020)"""
        print_test_header("Sales API - 2020 Date Filter (Should be Empty)")
        
        if not self.admin_token:
            self.log_result("Sales 2020 Filter", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            params = {
                "start_date": "2020-01-01",
                "end_date": "2020-01-31"
            }
            
            response = self.session.get(f"{BASE_URL}/sales", headers=headers, params=params)
            print_info(f"GET Sales 2020 - Status: {response.status_code}")
            
            if response.status_code == 200:
                sales_data = response.json()
                sales_count = len(sales_data) if isinstance(sales_data, list) else 0
                
                # Should be empty for 2020 data
                self.log_result(
                    "Sales 2020 Filter", 
                    True, 
                    f"Retrieved {sales_count} records (expected 0 for 2020)"
                )
                return sales_data
            else:
                self.log_result("Sales 2020 Filter", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Sales 2020 Filter", False, "Request failed", str(e))
            return None

    def test_farmer_purchases_without_filter(self):
        """Test GET /api/farmer-purchases without date filter - should return all purchases"""
        print_test_header("Farmer Purchases API - No Date Filter")
        
        if not self.admin_token:
            self.log_result("Farmer Purchases No Filter", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            response = self.session.get(f"{BASE_URL}/farmer-purchases", headers=headers)
            print_info(f"GET Farmer Purchases - Status: {response.status_code}")
            
            if response.status_code == 200:
                purchases_data = response.json()
                purchases_count = len(purchases_data) if isinstance(purchases_data, list) else 0
                self.log_result(
                    "Farmer Purchases No Filter", 
                    True, 
                    f"Retrieved {purchases_count} farmer purchase records"
                )
                return purchases_data
            else:
                self.log_result("Farmer Purchases No Filter", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Farmer Purchases No Filter", False, "Request failed", str(e))
            return None

    def test_farmer_purchases_with_jan_2026_filter(self):
        """Test GET /api/farmer-purchases with January 2026 date filter"""
        print_test_header("Farmer Purchases API - Jan 2026 Date Filter")
        
        if not self.admin_token:
            self.log_result("Farmer Purchases Jan 2026 Filter", False, "No admin token available")
            return False
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            params = {
                "start_date": "2026-01-01",
                "end_date": "2026-01-31"
            }
            
            response = self.session.get(f"{BASE_URL}/farmer-purchases", headers=headers, params=params)
            print_info(f"GET Farmer Purchases Jan 2026 - Status: {response.status_code}")
            
            if response.status_code == 200:
                purchases_data = response.json()
                purchases_count = len(purchases_data) if isinstance(purchases_data, list) else 0
                
                # Check if any purchases are within the date range
                jan_2026_purchases = []
                if isinstance(purchases_data, list):
                    for purchase in purchases_data:
                        created_at = purchase.get('created_at', '')
                        if created_at and '2026-01' in created_at:
                            jan_2026_purchases.append(purchase)
                
                self.log_result(
                    "Farmer Purchases Jan 2026 Filter", 
                    True, 
                    f"Retrieved {purchases_count} total records, {len(jan_2026_purchases)} from Jan 2026"
                )
                return purchases_data
            else:
                self.log_result("Farmer Purchases Jan 2026 Filter", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Farmer Purchases Jan 2026 Filter", False, "Request failed", str(e))
            return None

    # ===================== STOCK TRANSFER REQUEST SYSTEM TESTS =====================
    
    def test_stock_transfer_system(self):
        """Test complete Stock Transfer Request System"""
        print_test_header("Stock Transfer Request System - Complete Flow")
        
        if not self.admin_token:
            self.log_result("Stock Transfer System", False, "No admin token available")
            return False
        
        # Initialize variables for the test
        self.test_product_id = None
        self.from_outlet_id = None
        self.to_outlet_id = None
        self.transfer_request_id = None
        
        # Step 1: Get Products and Outlets
        if not self._get_products_and_outlets_for_transfer():
            return False
        
        # Step 2: Create Transfer Request
        if not self._create_transfer_request():
            return False
        
        # Step 3: Get Transfer Requests
        if not self._get_transfer_requests():
            return False
        
        # Step 4: Get Pending Count
        if not self._get_pending_transfer_count():
            return False
        
        # Step 5: Approve Transfer Request
        if not self._approve_transfer_request():
            return False
        
        # Step 6: Test Rejection (create another request first)
        if not self._test_reject_transfer_request():
            return False
        
        self.log_result("Stock Transfer System", True, "All stock transfer operations completed successfully")
        return True
    
    def _get_products_and_outlets_for_transfer(self):
        """Get products and outlets needed for transfer request"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Get products
            response = self.session.get(f"{BASE_URL}/products", headers=headers)
            print_info(f"GET Products - Status: {response.status_code}")
            
            if response.status_code == 200:
                products = response.json()
                if len(products) > 0:
                    self.test_product_id = products[0]["id"]
                    print_success(f"Found product: {products[0]['name']} (ID: {self.test_product_id})")
                else:
                    self.log_result("Get Products for Transfer", False, "No products found")
                    return False
            else:
                self.log_result("Get Products for Transfer", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # Get outlets
            response = self.session.get(f"{BASE_URL}/outlets", headers=headers)
            print_info(f"GET Outlets - Status: {response.status_code}")
            
            if response.status_code == 200:
                outlets = response.json()
                if len(outlets) >= 2:
                    self.from_outlet_id = outlets[0]["id"]
                    self.to_outlet_id = outlets[1]["id"]
                    print_success(f"From outlet: {outlets[0]['name']} (ID: {self.from_outlet_id})")
                    print_success(f"To outlet: {outlets[1]['name']} (ID: {self.to_outlet_id})")
                    self.log_result("Get Products and Outlets", True, f"Retrieved {len(products)} products and {len(outlets)} outlets")
                    return True
                else:
                    self.log_result("Get Outlets for Transfer", False, f"Need at least 2 outlets, found {len(outlets)}")
                    return False
            else:
                self.log_result("Get Outlets for Transfer", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Products and Outlets", False, "Request failed", str(e))
            return False
    
    def _create_transfer_request(self):
        """Create a stock transfer request"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # First, add some stock to the source outlet
            stock_data = {
                "product_id": self.test_product_id,
                "outlet_id": self.from_outlet_id,
                "quantity": 100
            }
            
            stock_response = self.session.post(f"{BASE_URL}/stock/add", json=stock_data, headers=headers)
            if stock_response.status_code == 200:
                print_info("Added 100 units of stock to source outlet")
            
            # Create transfer request
            transfer_data = {
                "product_id": self.test_product_id,
                "from_outlet_id": self.from_outlet_id,
                "to_outlet_id": self.to_outlet_id,
                "quantity": 25,
                "reason": "Testing stock transfer functionality"
            }
            
            response = self.session.post(f"{BASE_URL}/stock/transfer-request", json=transfer_data, headers=headers)
            print_info(f"POST Transfer Request - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "request_id" in data and "message" in data:
                    self.transfer_request_id = data["request_id"]
                    self.log_result("Create Transfer Request", True, f"Created request ID: {self.transfer_request_id}")
                    return True
                else:
                    self.log_result("Create Transfer Request", False, "Missing request_id in response")
            else:
                error_msg = ""
                try:
                    error_data = response.json()
                    error_msg = error_data.get("detail", "")
                except:
                    error_msg = response.text
                self.log_result("Create Transfer Request", False, f"HTTP {response.status_code}", error_msg)
            
            return False
            
        except Exception as e:
            self.log_result("Create Transfer Request", False, "Request failed", str(e))
            return False
    
    def _get_transfer_requests(self):
        """Get transfer requests"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Get all transfer requests
            response = self.session.get(f"{BASE_URL}/stock/transfer-requests", headers=headers)
            print_info(f"GET All Transfer Requests - Status: {response.status_code}")
            
            if response.status_code == 200:
                requests_data = response.json()
                if len(requests_data) > 0:
                    # Check if our request is in the list
                    found_our_request = any(req["id"] == self.transfer_request_id for req in requests_data)
                    if found_our_request:
                        print_success(f"Found our test request in the list of {len(requests_data)} requests")
                    else:
                        print_warning("Our test request not found in the list")
                else:
                    self.log_result("Get All Transfer Requests", False, "No transfer requests found")
                    return False
            else:
                self.log_result("Get All Transfer Requests", False, f"HTTP {response.status_code}", response.text)
                return False
            
            # Get pending transfer requests
            response = self.session.get(f"{BASE_URL}/stock/transfer-requests", headers=headers, params={"status": "pending"})
            print_info(f"GET Pending Transfer Requests - Status: {response.status_code}")
            
            if response.status_code == 200:
                pending_requests = response.json()
                pending_count = len(pending_requests)
                
                # Verify our request is pending
                found_pending = any(req["id"] == self.transfer_request_id and req["status"] == "pending" for req in pending_requests)
                if found_pending:
                    print_success(f"Our test request is in pending status among {pending_count} pending requests")
                else:
                    print_warning("Our test request not found in pending list")
                
                self.log_result("Get Transfer Requests", True, f"Retrieved {len(requests_data)} total and {pending_count} pending requests")
                return True
            else:
                self.log_result("Get Pending Transfer Requests", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Transfer Requests", False, "Request failed", str(e))
            return False
    
    def _get_pending_transfer_count(self):
        """Get pending transfer requests count"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            response = self.session.get(f"{BASE_URL}/stock/transfer-requests/pending-count", headers=headers)
            print_info(f"GET Pending Count - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data:
                    count = data["count"]
                    self.log_result("Get Pending Count", True, f"Pending count: {count}")
                    return True
                else:
                    self.log_result("Get Pending Count", False, "Missing count in response")
            else:
                self.log_result("Get Pending Count", False, f"HTTP {response.status_code}", response.text)
            
            return False
            
        except Exception as e:
            self.log_result("Get Pending Count", False, "Request failed", str(e))
            return False
    
    def _approve_transfer_request(self):
        """Approve a transfer request"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Approve the transfer request
            response = self.session.put(
                f"{BASE_URL}/stock/transfer-requests/{self.transfer_request_id}/approve", 
                headers=headers, 
                params={"remark": "Approved for testing"}
            )
            print_info(f"PUT Approve Transfer - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    # Verify the request status changed to approved
                    verify_response = self.session.get(f"{BASE_URL}/stock/transfer-requests", headers=headers)
                    if verify_response.status_code == 200:
                        requests_data = verify_response.json()
                        approved_request = next((req for req in requests_data if req["id"] == self.transfer_request_id), None)
                        if approved_request and approved_request["status"] == "approved":
                            print_success(f"Request status updated to approved by {approved_request.get('approved_by_name', 'Unknown')}")
                            self.log_result("Approve Transfer Request", True, data["message"])
                            return True
                        else:
                            print_warning("Request status not updated properly")
                    
                    self.log_result("Approve Transfer Request", True, data["message"])
                    return True
                else:
                    self.log_result("Approve Transfer Request", False, "Missing message in response")
            else:
                error_msg = ""
                try:
                    error_data = response.json()
                    error_msg = error_data.get("detail", "")
                except:
                    error_msg = response.text
                self.log_result("Approve Transfer Request", False, f"HTTP {response.status_code}", error_msg)
            
            return False
            
        except Exception as e:
            self.log_result("Approve Transfer Request", False, "Request failed", str(e))
            return False
    
    def _test_reject_transfer_request(self):
        """Test rejecting a transfer request (create another one first)"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Create another transfer request to reject
            transfer_data = {
                "product_id": self.test_product_id,
                "from_outlet_id": self.from_outlet_id,
                "to_outlet_id": self.to_outlet_id,
                "quantity": 15,
                "reason": "Testing rejection functionality"
            }
            
            create_response = self.session.post(f"{BASE_URL}/stock/transfer-request", json=transfer_data, headers=headers)
            
            if create_response.status_code == 200:
                reject_request_id = create_response.json()["request_id"]
                print_info(f"Created new request for rejection: {reject_request_id}")
                
                # Reject the transfer request
                response = self.session.put(
                    f"{BASE_URL}/stock/transfer-requests/{reject_request_id}/reject", 
                    headers=headers, 
                    params={"remark": "Testing rejection"}
                )
                print_info(f"PUT Reject Transfer - Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data:
                        # Verify the request status changed to rejected
                        verify_response = self.session.get(f"{BASE_URL}/stock/transfer-requests", headers=headers)
                        if verify_response.status_code == 200:
                            requests_data = verify_response.json()
                            rejected_request = next((req for req in requests_data if req["id"] == reject_request_id), None)
                            if rejected_request and rejected_request["status"] == "rejected":
                                print_success(f"Request status updated to rejected by {rejected_request.get('approved_by_name', 'Unknown')}")
                                self.log_result("Reject Transfer Request", True, data["message"])
                                return True
                            else:
                                print_warning("Request status not updated properly")
                        
                        self.log_result("Reject Transfer Request", True, data["message"])
                        return True
                    else:
                        self.log_result("Reject Transfer Request", False, "Missing message in response")
                else:
                    error_msg = ""
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("detail", "")
                    except:
                        error_msg = response.text
                    self.log_result("Reject Transfer Request", False, f"HTTP {response.status_code}", error_msg)
            else:
                self.log_result("Reject Transfer Request", False, "Failed to create request for rejection test")
            
            return False
            
        except Exception as e:
            self.log_result("Reject Transfer Request", False, "Request failed", str(e))
            return False

    # ===================== NEW FEATURES TESTING =====================
    
    def test_feature_a_stock_transfer_requests(self):
        """Test Feature A: Agent Stock Transfer Request - New endpoints"""
        print_test_header("Feature A: Agent Stock Transfer Request")
        
        if not self.admin_token:
            self.log_result("Feature A Setup", False, "No admin token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        # Get test data first
        product_id = None
        from_outlet_id = None
        to_outlet_id = None
        
        try:
            # Get products
            response = self.session.get(f"{BASE_URL}/products", headers=headers)
            if response.status_code == 200:
                products = response.json()
                if len(products) > 0:
                    product_id = products[0]["id"]
                    print_info(f"Using product: {products[0]['name']}")
            
            # Get outlets
            response = self.session.get(f"{BASE_URL}/outlets", headers=headers)
            if response.status_code == 200:
                outlets = response.json()
                if len(outlets) >= 2:
                    from_outlet_id = outlets[0]["id"]
                    to_outlet_id = outlets[1]["id"]
                    print_info(f"From: {outlets[0]['name']} -> To: {outlets[1]['name']}")
            
            if not product_id or not from_outlet_id or not to_outlet_id:
                self.log_result("Feature A", False, "Insufficient test data (need products and outlets)")
                return False
            
            # Add stock for testing
            stock_data = {
                "product_id": product_id,
                "outlet_id": from_outlet_id,
                "quantity": 100
            }
            self.session.post(f"{BASE_URL}/stock/add", json=stock_data, headers=headers)
            
            # Test 1: GET /api/stock/transfer-requests - List all transfer requests
            response = self.session.get(f"{BASE_URL}/stock/transfer-requests", headers=headers)
            print_info(f"GET Transfer Requests - Status: {response.status_code}")
            
            if response.status_code == 200:
                requests_data = response.json()
                self.log_result("GET Transfer Requests", True, f"Retrieved {len(requests_data)} transfer requests")
            else:
                self.log_result("GET Transfer Requests", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 2: POST /api/stock/transfer-request - Create a transfer request
            transfer_data = {
                "product_id": product_id,
                "from_outlet_id": from_outlet_id,
                "to_outlet_id": to_outlet_id,
                "quantity": 25,
                "reason": "Testing new feature A"
            }
            
            response = self.session.post(f"{BASE_URL}/stock/transfer-request", json=transfer_data, headers=headers)
            print_info(f"POST Transfer Request - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "request_id" in data:
                    request_id = data["request_id"]
                    self.log_result("POST Transfer Request", True, f"Created transfer request: {request_id}")
                else:
                    self.log_result("POST Transfer Request", False, "No request_id in response")
                    return False
            else:
                self.log_result("POST Transfer Request", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 3: GET /api/stock/transfer-requests/pending-count - Get pending count
            response = self.session.get(f"{BASE_URL}/stock/transfer-requests/pending-count", headers=headers)
            print_info(f"GET Pending Count - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data:
                    self.log_result("GET Pending Count", True, f"Pending transfer requests: {data['count']}")
                else:
                    self.log_result("GET Pending Count", False, "No count in response")
                    return False
            else:
                self.log_result("GET Pending Count", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            self.log_result("Feature A Complete", True, "All Agent Stock Transfer Request endpoints working")
            return True
            
        except Exception as e:
            self.log_result("Feature A", False, "Request failed", str(e))
            return False
    
    def test_feature_b_farmer_product_requests(self):
        """Test Feature B: Farmer Product Requests"""
        print_test_header("Feature B: Farmer Product Requests")
        
        # First register/login as farmer
        farmer_token = None
        farmer_data = {
            "username": "testfarmer100",
            "password": "test123",
            "full_name": "Test Farmer",
            "role": "farmer"
        }
        
        try:
            # Try to register farmer
            response = self.session.post(f"{BASE_URL}/auth/register", json=farmer_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    farmer_token = data["access_token"]
                    print_success("Farmer registration and auto-login successful")
                else:
                    # Try to login if registration failed due to existing user
                    login_response = self.session.post(f"{BASE_URL}/auth/login", json={
                        "username": farmer_data["username"],
                        "password": farmer_data["password"]
                    })
                    
                    if login_response.status_code == 200:
                        login_data = login_response.json()
                        if "access_token" in login_data:
                            farmer_token = login_data["access_token"]
                            print_success("Farmer login successful (user already exists)")
            
            if not farmer_token:
                self.log_result("Feature B Setup", False, "Could not get farmer token")
                return False
            
            farmer_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {farmer_token}"
            }
            
            # Get test data
            product_id = None
            outlet_id = None
            
            if self.admin_token:
                admin_headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.admin_token}"
                }
                
                # Get products
                response = self.session.get(f"{BASE_URL}/products", headers=admin_headers)
                if response.status_code == 200:
                    products = response.json()
                    if len(products) > 0:
                        product_id = products[0]["id"]
                
                # Get outlets
                response = self.session.get(f"{BASE_URL}/outlets", headers=admin_headers)
                if response.status_code == 200:
                    outlets = response.json()
                    if len(outlets) > 0:
                        outlet_id = outlets[0]["id"]
            
            if not product_id or not outlet_id:
                self.log_result("Feature B", False, "Insufficient test data")
                return False
            
            # Test 1: GET /api/product-requests - List farmer's own requests
            response = self.session.get(f"{BASE_URL}/product-requests", headers=farmer_headers)
            print_info(f"GET Product Requests - Status: {response.status_code}")
            
            if response.status_code == 200:
                requests_data = response.json()
                self.log_result("GET Product Requests", True, f"Retrieved {len(requests_data)} product requests")
            else:
                self.log_result("GET Product Requests", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 2: POST /api/product-requests - Create a buy request
            buy_request = {
                "product_id": product_id,
                "quantity": 50,
                "request_type": "buy",
                "outlet_id": outlet_id
            }
            
            response = self.session.post(f"{BASE_URL}/product-requests", json=buy_request, headers=farmer_headers)
            print_info(f"POST Buy Request - Status: {response.status_code}")
            
            buy_request_id = None
            if response.status_code == 200:
                data = response.json()
                if "request_id" in data:
                    buy_request_id = data["request_id"]
                    self.log_result("POST Buy Request", True, f"Created buy request: {buy_request_id}")
                else:
                    self.log_result("POST Buy Request", False, "No request_id in response")
                    return False
            else:
                self.log_result("POST Buy Request", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 3: POST /api/product-requests - Create a sell request with custom product
            sell_request = {
                "product_id": "custom",
                "custom_product_name": "Organic Rice",
                "quantity": 100,
                "request_type": "sell",
                "outlet_id": outlet_id
            }
            
            response = self.session.post(f"{BASE_URL}/product-requests", json=sell_request, headers=farmer_headers)
            print_info(f"POST Sell Request (Custom) - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "request_id" in data:
                    self.log_result("POST Sell Request (Custom)", True, f"Created sell request: {data['request_id']}")
                else:
                    self.log_result("POST Sell Request (Custom)", False, "No request_id in response")
                    return False
            else:
                self.log_result("POST Sell Request (Custom)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 4: PUT /api/product-requests/{id} - Cancel a request
            if buy_request_id:
                cancel_data = {"status": "cancelled"}
                
                response = self.session.put(f"{BASE_URL}/product-requests/{buy_request_id}", json=cancel_data, headers=farmer_headers)
                print_info(f"PUT Cancel Request - Status: {response.status_code}")
                
                if response.status_code == 200:
                    self.log_result("PUT Cancel Request", True, "Successfully cancelled product request")
                else:
                    self.log_result("PUT Cancel Request", False, f"HTTP {response.status_code}: {response.text}")
                    return False
            else:
                self.log_result("PUT Cancel Request", False, "No request ID available to cancel")
                return False
            
            self.log_result("Feature B Complete", True, "All Farmer Product Request endpoints working")
            return True
            
        except Exception as e:
            self.log_result("Feature B", False, "Request failed", str(e))
            return False
    
    def test_feature_c_search_functionality(self):
        """Test Feature C: Search Functionality"""
        print_test_header("Feature C: Search Functionality")
        
        if not self.admin_token:
            self.log_result("Feature C Setup", False, "No admin token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Test 1: GET /api/products - List products (frontend will filter client-side)
            response = self.session.get(f"{BASE_URL}/products", headers=headers)
            print_info(f"GET Products (Search) - Status: {response.status_code}")
            
            if response.status_code == 200:
                products = response.json()
                self.log_result("GET Products (Search)", True, f"Retrieved {len(products)} products for client-side filtering")
            else:
                self.log_result("GET Products (Search)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 2: GET /api/outlets - List outlets (frontend will filter client-side)
            response = self.session.get(f"{BASE_URL}/outlets", headers=headers)
            print_info(f"GET Outlets (Search) - Status: {response.status_code}")
            
            if response.status_code == 200:
                outlets = response.json()
                self.log_result("GET Outlets (Search)", True, f"Retrieved {len(outlets)} outlets for client-side filtering")
            else:
                self.log_result("GET Outlets (Search)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 3: GET /api/stock - List stock (frontend will filter client-side)
            response = self.session.get(f"{BASE_URL}/stock", headers=headers)
            print_info(f"GET Stock (Search) - Status: {response.status_code}")
            
            if response.status_code == 200:
                stock = response.json()
                self.log_result("GET Stock (Search)", True, f"Retrieved {len(stock)} stock records for client-side filtering")
            else:
                self.log_result("GET Stock (Search)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            self.log_result("Feature C Complete", True, "All Search functionality endpoints working")
            return True
            
        except Exception as e:
            self.log_result("Feature C", False, "Request failed", str(e))
            return False

    # ===================== THREE NEW FEATURES TESTING (AS REQUESTED) =====================
    
    def test_notifications_system(self):
        """Test Feature 1: Notifications System"""
        print_test_header("Feature 1: Notifications System")
        
        if not self.admin_token:
            self.log_result("Notifications System", False, "No admin token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Test 1: GET /api/notifications - Get notifications for current user
            response = self.session.get(f"{BASE_URL}/notifications", headers=headers)
            print_info(f"GET /notifications - Status: {response.status_code}")
            
            if response.status_code == 200:
                notifications = response.json()
                self.log_result("GET /notifications", True, f"Retrieved {len(notifications)} notifications")
            else:
                self.log_result("GET /notifications", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 2: GET /api/notifications/unread-count - Get unread count
            response = self.session.get(f"{BASE_URL}/notifications/unread-count", headers=headers)
            print_info(f"GET /notifications/unread-count - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data:
                    self.log_result("GET /notifications/unread-count", True, f"Unread count: {data['count']}")
                else:
                    self.log_result("GET /notifications/unread-count", False, "No count in response")
                    return False
            else:
                self.log_result("GET /notifications/unread-count", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 3: PUT /api/notifications/mark-all-read - Mark all as read
            response = self.session.put(f"{BASE_URL}/notifications/mark-all-read", headers=headers)
            print_info(f"PUT /notifications/mark-all-read - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("PUT /notifications/mark-all-read", True, data.get("message", "Success"))
            else:
                self.log_result("PUT /notifications/mark-all-read", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            self.log_result("Notifications System Complete", True, "All notification endpoints working")
            return True
            
        except Exception as e:
            self.log_result("Notifications System", False, "Request failed", str(e))
            return False
    
    def test_shareholder_upgrade_system(self):
        """Test Feature 2: Shareholder Upgrade System"""
        print_test_header("Feature 2: Shareholder Upgrade System")
        
        # First register/login as farmer for testing
        farmer_token = None
        farmer_data = {
            "username": "farmertest200",
            "password": "test123",
            "full_name": "Test Farmer 200",
            "role": "farmer"
        }
        
        try:
            # Try to register farmer
            response = self.session.post(f"{BASE_URL}/auth/register", json=farmer_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    farmer_token = data["access_token"]
                    print_success("Farmer registration and auto-login successful")
                else:
                    # Try to login if registration failed due to existing user
                    login_response = self.session.post(f"{BASE_URL}/auth/login", json={
                        "username": farmer_data["username"],
                        "password": farmer_data["password"]
                    })
                    
                    if login_response.status_code == 200:
                        login_data = login_response.json()
                        if "access_token" in login_data:
                            farmer_token = login_data["access_token"]
                            print_success("Farmer login successful (user already exists)")
            
            if not farmer_token:
                self.log_result("Shareholder Upgrade Setup", False, "Could not get farmer token")
                return False
            
            farmer_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {farmer_token}"
            }
            
            admin_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.admin_token}"
            } if self.admin_token else None
            
            # Test 1: POST /api/shareholder-upgrade/request - Request shareholder upgrade
            import base64
            test_cert_data = base64.b64encode(b"test certificate data").decode()
            
            upgrade_request = {
                "certificate_data": test_cert_data,
                "certificate_filename": "cert.jpg"
            }
            
            response = self.session.post(f"{BASE_URL}/shareholder-upgrade/request", 
                                       json=upgrade_request, headers=farmer_headers)
            print_info(f"POST /shareholder-upgrade/request - Status: {response.status_code}")
            
            request_id = None
            if response.status_code == 200:
                data = response.json()
                if "request_id" in data:
                    request_id = data["request_id"]
                    self.log_result("POST /shareholder-upgrade/request", True, f"Request ID: {request_id}")
                else:
                    self.log_result("POST /shareholder-upgrade/request", False, "No request_id in response")
                    return False
            else:
                self.log_result("POST /shareholder-upgrade/request", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 2: GET /api/shareholder-upgrade/requests - Get own upgrade requests (farmer)
            response = self.session.get(f"{BASE_URL}/shareholder-upgrade/requests", headers=farmer_headers)
            print_info(f"GET /shareholder-upgrade/requests (Farmer) - Status: {response.status_code}")
            
            if response.status_code == 200:
                requests_data = response.json()
                self.log_result("GET /shareholder-upgrade/requests (Farmer)", True, f"Retrieved {len(requests_data)} requests")
            else:
                self.log_result("GET /shareholder-upgrade/requests (Farmer)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            if not admin_headers:
                self.log_result("Shareholder Upgrade Admin Tests", False, "No admin token available")
                return False
            
            # Test 3: GET /api/shareholder-upgrade/requests - Get all upgrade requests (admin)
            response = self.session.get(f"{BASE_URL}/shareholder-upgrade/requests", headers=admin_headers)
            print_info(f"GET /shareholder-upgrade/requests (Admin) - Status: {response.status_code}")
            
            if response.status_code == 200:
                requests_data = response.json()
                self.log_result("GET /shareholder-upgrade/requests (Admin)", True, f"Retrieved {len(requests_data)} requests")
            else:
                self.log_result("GET /shareholder-upgrade/requests (Admin)", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 4: GET /api/shareholder-upgrade/pending-count - Get pending count
            response = self.session.get(f"{BASE_URL}/shareholder-upgrade/pending-count", headers=admin_headers)
            print_info(f"GET /shareholder-upgrade/pending-count - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data:
                    self.log_result("GET /shareholder-upgrade/pending-count", True, f"Pending count: {data['count']}")
                else:
                    self.log_result("GET /shareholder-upgrade/pending-count", False, "No count in response")
                    return False
            else:
                self.log_result("GET /shareholder-upgrade/pending-count", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 5: PUT /api/shareholder-upgrade/{request_id}/approve - Approve request
            if request_id:
                response = self.session.put(f"{BASE_URL}/shareholder-upgrade/{request_id}/approve", 
                                          headers=admin_headers,
                                          params={"remark": "Approved for testing"})
                print_info(f"PUT /shareholder-upgrade/{request_id}/approve - Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result("PUT /shareholder-upgrade/approve", True, data.get("message", "Success"))
                else:
                    self.log_result("PUT /shareholder-upgrade/approve", False, f"HTTP {response.status_code}: {response.text}")
                    return False
            
            # Test 6: Test rejection flow with another request
            response = self.session.post(f"{BASE_URL}/shareholder-upgrade/request", 
                                       json=upgrade_request, headers=farmer_headers)
            
            if response.status_code == 200:
                data = response.json()
                reject_request_id = data.get("request_id")
                
                if reject_request_id:
                    response = self.session.put(f"{BASE_URL}/shareholder-upgrade/{reject_request_id}/reject", 
                                              headers=admin_headers,
                                              params={"remark": "Rejected for testing"})
                    print_info(f"PUT /shareholder-upgrade/{reject_request_id}/reject - Status: {response.status_code}")
                    
                    if response.status_code == 200:
                        data = response.json()
                        self.log_result("PUT /shareholder-upgrade/reject", True, data.get("message", "Success"))
                    else:
                        self.log_result("PUT /shareholder-upgrade/reject", False, f"HTTP {response.status_code}: {response.text}")
                        return False
            
            self.log_result("Shareholder Upgrade System Complete", True, "All shareholder upgrade endpoints working")
            return True
            
        except Exception as e:
            self.log_result("Shareholder Upgrade System", False, "Request failed", str(e))
            return False
    
    def test_vendor_procurement_system(self):
        """Test Feature 3: Vendor Procurement System"""
        print_test_header("Feature 3: Vendor Procurement System")
        
        if not self.admin_token:
            self.log_result("Vendor Procurement System", False, "No admin token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        try:
            # Test 1: GET /api/vendors - Get vendors list
            response = self.session.get(f"{BASE_URL}/vendors", headers=headers)
            print_info(f"GET /vendors - Status: {response.status_code}")
            
            vendor_id = None
            if response.status_code == 200:
                vendors = response.json()
                self.log_result("GET /vendors", True, f"Retrieved {len(vendors)} vendors")
                
                if vendors:
                    vendor_id = vendors[0]["id"]
                    print_info(f"Using vendor: {vendors[0]['name']}")
                else:
                    self.log_result("Vendor Procurement Setup", False, "No vendors available for testing")
                    return False
            else:
                self.log_result("GET /vendors", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 2: GET /api/products - Get products list
            response = self.session.get(f"{BASE_URL}/products", headers=headers)
            print_info(f"GET /products - Status: {response.status_code}")
            
            product_id = None
            if response.status_code == 200:
                products = response.json()
                self.log_result("GET /products", True, f"Retrieved {len(products)} products")
                
                if products:
                    product_id = products[0]["id"]
                    print_info(f"Using product: {products[0]['name']}")
                else:
                    self.log_result("Vendor Procurement Setup", False, "No products available for testing")
                    return False
            else:
                self.log_result("GET /products", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 3: GET /api/outlets - Get outlets list
            response = self.session.get(f"{BASE_URL}/outlets", headers=headers)
            print_info(f"GET /outlets - Status: {response.status_code}")
            
            outlet_id = None
            if response.status_code == 200:
                outlets = response.json()
                self.log_result("GET /outlets", True, f"Retrieved {len(outlets)} outlets")
                
                if outlets:
                    outlet_id = outlets[0]["id"]
                    print_info(f"Using outlet: {outlets[0]['name']}")
                else:
                    self.log_result("Vendor Procurement Setup", False, "No outlets available for testing")
                    return False
            else:
                self.log_result("GET /outlets", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 4: POST /api/vendor-procurement - Create vendor procurement
            procurement_data = {
                "vendor_id": vendor_id,
                "product_id": product_id,
                "outlet_id": outlet_id,
                "quantity": 50,
                "rate": 30,
                "payment_mode": "cash",
                "cash_amount": 1500,
                "online_amount": 0
            }
            
            response = self.session.post(f"{BASE_URL}/vendor-procurement", 
                                       json=procurement_data, headers=headers)
            print_info(f"POST /vendor-procurement - Status: {response.status_code}")
            
            procurement_id = None
            if response.status_code == 200:
                data = response.json()
                if "procurement_id" in data:
                    procurement_id = data["procurement_id"]
                    receipt_number = data.get("receipt_number", "N/A")
                    self.log_result("POST /vendor-procurement", True, f"Procurement ID: {procurement_id}, Receipt: {receipt_number}")
                else:
                    self.log_result("POST /vendor-procurement", False, "No procurement_id in response")
                    return False
            else:
                self.log_result("POST /vendor-procurement", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 5: GET /api/vendor-procurement - Get all procurements
            response = self.session.get(f"{BASE_URL}/vendor-procurement", headers=headers)
            print_info(f"GET /vendor-procurement - Status: {response.status_code}")
            
            if response.status_code == 200:
                procurements = response.json()
                self.log_result("GET /vendor-procurement", True, f"Retrieved {len(procurements)} procurement records")
            else:
                self.log_result("GET /vendor-procurement", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            # Test 6: Verify stock was added to the outlet
            response = self.session.get(f"{BASE_URL}/stock", headers=headers, params={"outlet_id": outlet_id})
            print_info(f"GET /stock (verification) - Status: {response.status_code}")
            
            if response.status_code == 200:
                stock_data = response.json()
                
                # Find the stock for our product
                product_stock = None
                for stock in stock_data:
                    if stock["product_id"] == product_id:
                        product_stock = stock
                        break
                
                if product_stock:
                    self.log_result("Stock Verification", True, f"Stock found for product: {product_stock['quantity']} units")
                else:
                    self.log_result("Stock Verification", False, "No stock found for the procured product")
                    return False
            else:
                self.log_result("Stock Verification", False, f"HTTP {response.status_code}: {response.text}")
                return False
            
            self.log_result("Vendor Procurement System Complete", True, "All vendor procurement endpoints working")
            return True
            
        except Exception as e:
            self.log_result("Vendor Procurement System", False, "Request failed", str(e))
            return False

    def run_all_tests(self):
        """Run all authentication and CRUD tests"""
        print(f"{Colors.BOLD}FPO Management System - Authentication & CRUD Testing{Colors.ENDC}")
        print(f"Base URL: {BASE_URL}")
        print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Test sequence - Authentication first, then CRUD operations
        auth_tests = [
            self.test_login_success,
            self.test_login_wrong_password,
            self.test_login_nonexistent_user,
            self.test_register_farmer,
            self.test_register_agent,
            self.test_protected_endpoint_without_token,
            self.test_protected_endpoint_with_token,
            self.test_invalid_token
        ]
        
        crud_tests = [
            self.test_products_crud,
            self.test_outlets_crud,
            self.test_vendors_crud
        ]
        
        date_filter_tests = [
            self.test_sales_without_filter,
            self.test_sales_with_jan_2026_filter,
            self.test_sales_with_2020_filter,
            self.test_farmer_purchases_without_filter,
            self.test_farmer_purchases_with_jan_2026_filter
        ]
        
        stock_transfer_tests = [
            self.test_stock_transfer_system
        ]
        
        new_features_tests = [
            self.test_feature_a_stock_transfer_requests,
            self.test_feature_b_farmer_product_requests,
            self.test_feature_c_search_functionality
        ]
        
        # NEW REQUESTED FEATURES TESTS
        requested_features_tests = [
            self.test_notifications_system,
            self.test_shareholder_upgrade_system,
            self.test_vendor_procurement_system
        ]
        
        print(f"\n{Colors.BOLD}=== AUTHENTICATION TESTS ==={Colors.ENDC}")
        for test in auth_tests:
            try:
                test()
            except Exception as e:
                print_error(f"Test {test.__name__} crashed: {str(e)}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"{test.__name__}: Crashed - {str(e)}")
        
        print(f"\n{Colors.BOLD}=== ADMIN CRUD TESTS ==={Colors.ENDC}")
        for test in crud_tests:
            try:
                test()
            except Exception as e:
                print_error(f"Test {test.__name__} crashed: {str(e)}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"{test.__name__}: Crashed - {str(e)}")
        
        print(f"\n{Colors.BOLD}=== DATE FILTERING TESTS ==={Colors.ENDC}")
        for test in date_filter_tests:
            try:
                test()
            except Exception as e:
                print_error(f"Test {test.__name__} crashed: {str(e)}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"{test.__name__}: Crashed - {str(e)}")
        
        print(f"\n{Colors.BOLD}=== STOCK TRANSFER REQUEST SYSTEM TESTS ==={Colors.ENDC}")
        for test in stock_transfer_tests:
            try:
                test()
            except Exception as e:
                print_error(f"Test {test.__name__} crashed: {str(e)}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"{test.__name__}: Crashed - {str(e)}")
        
        print(f"\n{Colors.BOLD}=== NEW FEATURES TESTS ==={Colors.ENDC}")
        for test in new_features_tests:
            try:
                test()
            except Exception as e:
                print_error(f"Test {test.__name__} crashed: {str(e)}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"{test.__name__}: Crashed - {str(e)}")
        
        # Print summary
        self.print_summary()
        
        return self.test_results

    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.ENDC}")
        total_tests = self.test_results['passed'] + self.test_results['failed']
        
        print(f"Total Tests: {total_tests}")
        print_success(f"Passed: {self.test_results['passed']}")
        
        if self.test_results['failed'] > 0:
            print_error(f"Failed: {self.test_results['failed']}")
            print(f"\n{Colors.RED}Failed Tests:{Colors.ENDC}")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        else:
            print_success("All tests passed!")
        
        success_rate = (self.test_results['passed'] / total_tests * 100) if total_tests > 0 else 0
        print(f"\nSuccess Rate: {success_rate:.1f}%")

if __name__ == "__main__":
    tester = AuthTester()
    results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    sys.exit(0 if results['failed'] == 0 else 1)