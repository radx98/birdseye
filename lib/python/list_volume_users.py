import json
import os
import sys

root = sys.argv[1]
users = []
for name in os.listdir(root):
    if name.startswith('.'):
        continue
    path = os.path.join(root, name)
    if os.path.isdir(path):
        users.append(name)

users.sort()
print(json.dumps(users))
