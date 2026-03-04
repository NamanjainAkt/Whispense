// appwrite-functions/clerk-auth/src/index.js
import { Client, Users, ID } from 'node-appwrite';

// This function bridges Clerk authentication to Appwrite
// It creates a user in Appwrite (if not exists) and generates a custom token

export default async ({ req, res, log, error }) => {
  try {
    // Get request body
    const { userId, email, name } = JSON.parse(req.body);

    if (!userId || !email) {
      return res.json({
        success: false,
        message: 'Missing required fields: userId, email'
      }, 400);
    }

    // Initialize Appwrite Server SDK
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);

    let appwriteUser;

    try {
      // Try to get existing user
      appwriteUser = await users.get(userId);
      log(`Found existing user: ${userId}`);
    } catch (err) {
      // User doesn't exist, create new one
      log(`Creating new user: ${userId}`);
      appwriteUser = await users.create(
        userId,  // Use Clerk user ID as Appwrite user ID
        email,
        null,    // phone (optional)
        undefined, // password (not needed for custom token)
        name || email.split('@')[0]
      );
    }

    // Create a custom token for this user
    const token = await users.createToken(
      appwriteUser.$id,
      undefined, // expiration (default)
      32         // length (longer for security)
    );

    log(`Token created for user: ${appwriteUser.$id}`);

    return res.json({
      success: true,
      userId: appwriteUser.$id,
      tokenSecret: token.secret,
      email: appwriteUser.email
    });

  } catch (err) {
    error(`Error: ${err.message}`);
    return res.json({
      success: false,
      message: err.message
    }, 500);
  }
};
