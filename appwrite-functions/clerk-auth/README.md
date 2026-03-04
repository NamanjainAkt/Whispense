# Clerk Auth Function for Appwrite

This Appwrite Function bridges Clerk authentication to Appwrite by creating users and generating custom tokens.

## How it works

1. Client calls this function after Clerk sign-in
2. Function creates Appwrite user (if not exists) using Clerk user ID
3. Function generates a custom token for the user
4. Client uses token secret to create Appwrite session via `account.createSession()`

## Deployment

### 1. Create the Function in Appwrite Console

1. Go to Appwrite Console → Functions
2. Click **"Create Function"**
3. Name: `clerk-auth`
4. Runtime: `Node.js (node-18.0)`
5. Entrypoint: `src/index.js`
6. Click **Create**

### 2. Set Environment Variables

In the Function settings, add these environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `APPWRITE_FUNCTION_ENDPOINT` | `https://sgp.cloud.appwrite.io/v1` | Your Appwrite endpoint |
| `APPWRITE_FUNCTION_PROJECT_ID` | `69a7401f00079fd976ab` | Your project ID |
| `APPWRITE_API_KEY` | `standard_...` | Your API key (with `users.write` scope) |

### 3. Deploy the Function

**Option A: Manual Deploy**
1. Go to Function → Overview → Deploy
2. Upload the `clerk-auth` folder as a ZIP

**Option B: CLI Deploy**
```bash
# Install Appwrite CLI
npm install -g appwrite-cli

# Login
appwrite login

# Deploy
appwrite deploy function --function-id=clerk-auth
```

### 4. Configure Permissions

In Function settings → Execute Access:
- Add role: `any` (allows unauthenticated calls)
- Or add: `users` (if you want only authenticated users, but this is a chicken-egg problem)

For this use case, `any` is fine since we're verifying via Clerk first.

## API Usage

### Request
```json
POST /v1/functions/clerk-auth/executions
Content-Type: application/json

{
  "userId": "user_123456789",
  "email": "user@example.com",
  "name": "John Doe"
}
```

### Response
```json
{
  "success": true,
  "userId": "user_123456789",
  "tokenSecret": "a1b2c3d4e5f6...",
  "email": "user@example.com"
}
```

## Security Considerations

- This function should be called immediately after Clerk authentication
- The token secret is short-lived (expires in 15 minutes by default)
- Consider adding rate limiting in production
- Optionally verify Clerk JWT in this function for extra security
