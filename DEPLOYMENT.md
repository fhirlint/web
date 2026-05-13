# Deployment

## Docker

```bash
# Build
sudo docker build -t fhirlint-web .

# Run (binds to localhost:8080 only)
sudo docker run -d \
  -p 127.0.0.1:8080:8080 \
  -v fhirlint-cache:/root/.fhirlint \
  --name fhirlint-web \
  --restart unless-stopped \
  fhirlint-web
```

The validator JAR (~250 MB) is downloaded on first use and stored in the `fhirlint-cache` volume, so subsequent restarts are fast.

### Update

```bash
sudo docker stop fhirlint-web && sudo docker rm fhirlint-web
sudo docker build -t fhirlint-web .
# then re-run the docker run command above
```

## nginx reverse proxy

Place this in `/etc/nginx/sites-available/fhirlint` and symlink to `sites-enabled`:

```nginx
server {
    listen 80;
    server_name fhirlint.example.local;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host            $host;
        proxy_set_header   X-Real-IP       $remote_addr;

        # The HL7 validator can take several minutes on a cold start
        proxy_read_timeout 360s;
        proxy_send_timeout 360s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fhirlint /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Add a DNS entry (or `/etc/hosts` line) pointing the hostname to the server's IP.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `8080`  | TCP port the server listens on |
