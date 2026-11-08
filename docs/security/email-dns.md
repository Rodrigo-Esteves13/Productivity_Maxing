# Email and DNS hardening for pmaxing.pt

Checked with DNS lookups on 2026-11-08. The DNS zone is managed at the domain
registrar, not in this repository, so these records must be added by hand.

## What exists today

| Record | Value | Verdict |
| --- | --- | --- |
| `_dmarc.pmaxing.pt` TXT | `v=DMARC1; p=none;` | Monitoring only. Spoofed mail is still delivered and nobody receives reports. This is the "partial anti-spoofing" warning. |
| `pmaxing.pt` TXT (SPF) | `v=spf1 include:spf.improvmx.com ~all` | Covers the inbound forwarder (ImprovMX) only. Soft fail. |
| `resend._domainkey.pmaxing.pt` TXT | DKIM public key | Good. Mail sent by the app through Resend is signed. |
| `send.pmaxing.pt` TXT and MX | Resend return-path SPF and bounce MX | Good. Resend aligns SPF on the `send` subdomain. |
| CAA | none | Any certificate authority may issue for the domain. |
| `_mta-sts` and `_smtp._tls` | none | No transport security policy or TLS reports for inbound mail. |

The app sends transactional mail through Resend (see `backend/src/mail`), and
the mail is DKIM signed, so DMARC will pass for it once the policy is enforced.

## Records to add

Do these in order and wait for reports between steps.

1. Reports first. Create an alias such as `dmarc@pmaxing.pt` in ImprovMX that
   forwards to a mailbox you read.
2. Replace the DMARC record with a staged policy:

   ```
   _dmarc.pmaxing.pt  TXT  "v=DMARC1; p=quarantine; pct=25; sp=quarantine; adkim=r; aspf=r; rua=mailto:dmarc@pmaxing.pt; fo=1"
   ```

3. After one to two weeks of reports with no legitimate source failing, raise
   `pct` to 100, then change `p=quarantine` to `p=reject`.
4. Anything you send from `@pmaxing.pt` outside Resend (for example Gmail
   "send mail as" through Google) will fail DMARC until that provider is added to
   SPF and signs with DKIM. The aggregate reports show every sender, so check
   them before moving to `reject`.
5. Tighten SPF only if you stop using soft fail on purpose:
   `v=spf1 include:spf.improvmx.com -all` (add any other sender first).
6. Restrict certificate issuance:

   ```
   pmaxing.pt  CAA  0 issue "letsencrypt.org"
   pmaxing.pt  CAA  0 iodef "mailto:support@pmaxing.pt"
   ```

   Replace `letsencrypt.org` with the authorities that actually issue for
   Netlify and Render (check the certificates of `app.pmaxing.pt` and
   `api.pmaxing.pt` first), or the renewals will fail.
7. Optional: TLS reporting for inbound mail:

   ```
   _smtp._tls.pmaxing.pt  TXT  "v=TLSRPTv1; rua=mailto:dmarc@pmaxing.pt"
   ```

## Not fixable in the repository

- "Domain age: could not verify" comes from the scanner not reading the `.pt`
  registry data. Nothing to change.
- MTA-STS needs a policy file served from `mta-sts.pmaxing.pt` that lists the
  ImprovMX mail servers. Skip it unless inbound mail is critical.

## What the repository already covers

`frontend/public/_headers` sets a strict CSP, HSTS with preload age,
`nosniff`, a referrer policy, a permissions policy, COOP and
`frame-ancestors 'none'`. `frontend/public/.well-known/security.txt` publishes
the security contact (RFC 9116). Renew its `Expires` date before it passes.
