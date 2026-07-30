# Presigned upload flow

Direct-to-storage uploads via presigned URLs with size/content-type limits and a completion webhook that verifies the object actually arrived — so your API server never touches file bytes.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** node, hono, aws-sdk (S3-compatible), zod · **Tracks:** backend, apis, security

## Deliverable

An upload flow where the client gets a presigned PUT URL, uploads directly to S3-compatible storage, and the server confirms receipt by fetching object metadata — never proxying file bytes.

## Why this project

Proxying uploads through your API server is a common beginner mistake — it wastes bandwidth, blocks request threads, and creates a single point of failure. Presigned URLs shift the heavy bytes directly to storage while keeping authorization on your server. The tricky parts are CORS, content-type enforcement before the upload, and confirming the object is real after it arrives.

## Skills

- presigned URL signing
- CORS preflight for direct upload
- content-type + size enforcement
- webhook idempotency

## Milestones

### 1. Issue a constrained presigned PUT

Issue a presigned PUT URL from the API with an expiry, allowed content-type header, and a max Content-Length constraint.

**Definition of done:**

- The API returns a presigned PUT URL with a short expiry, a fixed allowed content-type, and a max Content-Length.
- An expired or tampered URL (wrong content-type / oversize) is rejected by storage, not by the API.

### 2. Direct upload + verified receipt

Configure CORS on the bucket so the browser can upload directly without a proxy, then verify the object arrived by checking its ETag and size in the webhook.

**Definition of done:**

- The browser uploads directly to the bucket (CORS preflight passes) with no proxy through the API.
- The completion webhook confirms the object arrived by fetching its size/ETag, and is idempotent under duplicate deliveries.

## Rubric

### Presigned URL constraints

- **Junior:** The API issues a presigned PUT with no constraints; a client can upload a 5 GB video where a 2 MB image was expected, or substitute an arbitrary content-type.
- **Mid:** The URL is signed with an expiry, a fixed allowed Content-Type, and a max Content-Length; a tampered or oversize PUT is rejected by storage, not by the API, so enforcement is in the signature rather than in per-request application logic.
- **Senior:** You address key-clobber abuse: a presigned PUT to a predictable key allows any authenticated user to overwrite another user's file. You fix this with server-assigned UUID keys (never caller-chosen) and reason about the race window between upload and completion — a client can upload a valid file, then replace it before the webhook fires by re-using the URL within its expiry.

### CORS & direct-upload flow

- **Junior:** The browser upload is proxied through the API server; every upload passes through application memory and blocks a request thread for the duration.
- **Mid:** The S3 bucket CORS policy allows the browser origin to PUT directly; a preflight OPTIONS request passes cleanly, and no file bytes touch the API server.
- **Senior:** You lock the CORS policy to the minimum necessary: the exact allowed origin(s), the specific headers needed (Content-Type, x-amz-*), and a short max-age for the preflight cache. You explain why a wildcard CORS policy on a public bucket is not a vulnerability (no cookies, no ambient authority) but why it is still wrong on a private bucket where presigned URLs carry the authorization.

### Completion webhook & receipt verification

- **Junior:** The client self-reports completion; the server trusts the report and marks the upload as received without verifying the object exists or matches what was requested.
- **Mid:** The completion webhook fetches the object's ETag and size from storage and confirms they match the expected values; the webhook is idempotent so a duplicate delivery from a retry does not double-process.
- **Senior:** You reason about the substitution window: between the presigned PUT expiry and the webhook firing, a race exists where a different file can be uploaded to the same key. You prevent this by storing the expected ETag (derived from the pre-upload contract) and refusing to mark a receipt as valid if the stored ETag differs — and you document the tradeoff: ETag verification catches substitution but breaks multipart uploads where the ETag is assembled from part hashes.

## Senior stretch

- Replace single-part PUT with S3 multipart upload for files over 5 MB: create, upload parts in parallel, and complete — with resumable state stored server-side.
- Add server-side virus scanning on the completion webhook using a Lambda/Worker trigger before marking the upload as safe.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/presigned-upload
