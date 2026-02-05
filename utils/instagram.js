const axios = require("axios");

/**
 * Retrieves the recipient ID (PSID) for Instagram messaging.
 * @param {string} pageId - The Facebook page ID.
 * @param {string} pageToken - The page access token.
 * @returns {Promise<string>} The user ID.
 */
async function getRecipientId(pageId, pageToken) {
  try {
    console.log(`Getting conversations from ${pageId}/conversations?platform=instagram`);
    const convRes = await axios.get(
      `https://graph.facebook.com/v24.0/${pageId}/conversations`,
      {
        params: {
          platform: "instagram",
          access_token: pageToken,
        },
      }
    );

    if (!convRes.data.data || convRes.data.data.length === 0) {
      throw new Error("No Instagram conversations found.");
    }

    const threadId = convRes.data.data[0].id;
    console.log(`Thread ID: ${threadId}`);

    console.log(`Getting participants from ${threadId}?fields=participants`);
    const partRes = await axios.get(
      `https://graph.facebook.com/v24.0/${threadId}`,
      {
        params: {
          fields: "participants",
          access_token: pageToken,
        },
      }
    );

    const participants = partRes.data.participants.data;
    console.log(`Participants: ${JSON.stringify(participants)}`);
    const userParticipant = participants[1]; // Assuming second participant is the user

    if (!userParticipant) {
      throw new Error("No user participant found.");
    }

    const userId = userParticipant.id;
    console.log(`User ID: ${userId}`);
    return userId;
  } catch (error) {
    console.error(`Error in getRecipientId: ${error.message}`);
    throw error;
  }
}

/**
 * Gets the Instagram Business Account ID linked to a Facebook Page.
 * @param {string} pageId - The Facebook page ID.
 * @param {string} pageToken - The page access token.
 * @returns {Promise<string>} The Instagram Business Account ID.
 */
async function getInstagramAccountId(pageId, pageToken) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v24.0/${pageId}`,
      {
        params: {
          fields: "instagram_business_account",
          access_token: pageToken,
        },
      }
    );

    const igAccountId = response.data.instagram_business_account?.id;
    if (!igAccountId) {
      throw new Error("No Instagram Business Account linked to this page.");
    }

    console.log(`Instagram Account ID: ${igAccountId}`);
    return igAccountId;
  } catch (error) {
    console.error(`Error getting Instagram account: ${error.message}`);
    throw error;
  }
}

/**
 * Creates an Instagram media container for a single image post.
 * @param {string} igAccountId - The Instagram Business Account ID.
 * @param {string} imageUrl - The public URL of the image to post.
 * @param {string} caption - The caption for the post.
 * @param {string} pageToken - The page access token.
 * @returns {Promise<string>} The container ID.
 */
async function createMediaContainer(igAccountId, imageUrl, caption, pageToken) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${igAccountId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: caption,
          access_token: pageToken,
        },
      }
    );

    const containerId = response.data.id;
    console.log(`Media container created: ${containerId}`);
    return containerId;
  } catch (error) {
    console.error(`Error creating media container: ${error.response?.data || error.message}`);
    throw error;
  }
}

/**
 * Publishes an Instagram media container.
 * @param {string} igAccountId - The Instagram Business Account ID.
 * @param {string} containerId - The media container ID.
 * @param {string} pageToken - The page access token.
 * @returns {Promise<string>} The published media ID.
 */
async function publishMedia(igAccountId, containerId, pageToken) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${igAccountId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: pageToken,
        },
      }
    );

    const mediaId = response.data.id;
    console.log(`Media published: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error(`Error publishing media: ${error.response?.data || error.message}`);
    throw error;
  }
}

/**
 * Posts a single image to Instagram feed.
 * @param {string} pageId - The Facebook page ID.
 * @param {string} pageToken - The page access token.
 * @param {string} imageUrl - The public URL of the image to post.
 * @param {string} caption - The caption for the post.
 * @returns {Promise<string>} The published media ID.
 */
async function postToInstagramFeed(pageId, pageToken, imageUrl, caption) {
  try {
    // Step 1: Get Instagram Account ID
    const igAccountId = await getInstagramAccountId(pageId, pageToken);

    // Step 2: Create media container
    const containerId = await createMediaContainer(
      igAccountId,
      imageUrl,
      caption,
      pageToken
    );

    // Step 3: Wait for media to be processed (recommended by Facebook)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 4: Publish media
    const mediaId = await publishMedia(igAccountId, containerId, pageToken);

    return mediaId;
  } catch (error) {
    console.error(`Error posting to Instagram feed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getRecipientId,
  getInstagramAccountId,
  createMediaContainer,
  publishMedia,
  postToInstagramFeed
};
