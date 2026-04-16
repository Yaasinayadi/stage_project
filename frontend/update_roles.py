import os
import re

directory = '/home/zakariae/Desktop/github/stage_project/frontend/src'

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            new_content = content
            # Auth Context Types
            new_content = new_content.replace('type UserRole = "user" | "agent" | "admin"', 'type UserRole = "user" | "tech" | "admin"')
            new_content = new_content.replace('role: UserRole', 'x_support_role: UserRole')
            
            # API parsing (if there's any strict destructuring, but the types use user.role)
            new_content = new_content.replace('user.role', 'user.x_support_role')
            new_content = new_content.replace('user?.role', 'user?.x_support_role')
            
            # Role literals in code
            new_content = new_content.replace('=== "agent"', '=== "tech"')
            new_content = new_content.replace("=== 'agent'", "=== 'tech'")
            
            # ProtectedRoute
            new_content = new_content.replace('roles={["agent", "admin"]}', 'roles={["tech", "admin"]}')
            
            # Comments/API responses
            new_content = new_content.replace('c.role', 'c.x_support_role')
            new_content = new_content.replace('role?: string', 'x_support_role?: string')
            
            if new_content != content:
                with open(filepath, 'w') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
