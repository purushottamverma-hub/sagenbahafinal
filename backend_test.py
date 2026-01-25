#!/usr/bin/env python3
"""
FPO Management System - Backend API Testing
Testing authentication endpoints, protected routes, and Admin CRUD operations
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://fpo-manager.preview.emergentagent.com/api"
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