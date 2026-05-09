import paramiko
import os
import sys

host = '185.187.170.35'
username = 'suporte'
password = 'xr$5203XR$'
pubkey_path = os.path.expanduser('~/.ssh/id_ed25519.pub')

with open(pubkey_path, 'r') as f:
    pubkey = f.read().strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {host}...")
    client.connect(hostname=host, username=username, password=password, timeout=10)
    print("Connected successfully!")
    
    # Add key to authorized_keys
    cmd = f'mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "{pubkey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
    stdin, stdout, stderr = client.exec_command(cmd)
    
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    
    if err:
        print(f"Error: {err}")
    else:
        print("SSH key added successfully to authorized_keys.")
except Exception as e:
    print(f"Failed to connect or execute command: {e}")
finally:
    client.close()
