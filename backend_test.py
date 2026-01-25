#!/usr/bin/env python3
"""
FPO Management System - Backend API Testing
Testing authentication endpoints and protected routes
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

    def run_all_tests(self):
        """Run all authentication tests"""
        print(f"{Colors.BOLD}FPO Management System - Authentication Testing{Colors.ENDC}")
        print(f"Base URL: {BASE_URL}")
        print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Test sequence
        tests = [
            self.test_login_success,
            self.test_login_wrong_password,
            self.test_login_nonexistent_user,
            self.test_register_farmer,
            self.test_register_agent,
            self.test_protected_endpoint_without_token,
            self.test_protected_endpoint_with_token,
            self.test_invalid_token
        ]
        
        for test in tests:
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