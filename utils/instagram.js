import axios from "axios";

const getRecipientId = async (pageId, pageToken) => {
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
    const userParticipant = participants[1];

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
};

const getInstagramAccountId = async (pageId, pageToken) => {
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
};

const createMediaContainer = async (igAccountId, imageUrl, caption, pageToken) => {
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
};

const publishMedia = async (igAccountId, containerId, pageToken) => {
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
};

const postToInstagramFeed = async (pageId, pageToken, imageUrl, caption) => {
  try {
    const igAccountId = await getInstagramAccountId(pageId, pageToken);
    const containerId = await createMediaContainer(
      igAccountId,
      imageUrl,
      caption,
      pageToken
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const mediaId = await publishMedia(igAccountId, containerId, pageToken);

    return mediaId;
  } catch (error) {
    console.error(`Error posting to Instagram feed: ${error.message}`);
    throw error;
  }
};

export { createMediaContainer, getInstagramAccountId, getRecipientId, postToInstagramFeed, publishMedia };

