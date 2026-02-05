import axios from "axios";

const postToInstagramFeed = async (userId, accessToken, imageUrl, caption) => {
  try {
    // Create container
    const containerRes = await axios.post(
      `https://graph.instagram.com/${userId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: caption,
          access_token: accessToken,
        },
      }
    );

    const containerId = containerRes.data.id;
    console.log(`Media container created: ${containerId}`);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Publish
    const publishRes = await axios.post(
      `https://graph.instagram.com/${userId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken,
        },
      }
    );

    const mediaId = publishRes.data.id;
    console.log(`Media published: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error(`Error posting to Instagram feed: ${error.response?.data || error.message}`);
    throw error;
  }
};

const getInstagramPosts = async (userId, accessToken) => {
  try {
    const response = await axios.get(
      `https://graph.instagram.com/${userId}/media`,
      {
        params: {
          fields: "id,caption,media_type,media_url,timestamp,permalink,like_count,comments_count",
          access_token: accessToken,
        },
      }
    );

    if (!response.data.data || response.data.data.length === 0) {
      throw new Error("No Instagram posts found.");
    }

    console.log(`Found ${response.data.data.length} posts`);
    return response.data.data;
  } catch (error) {
    console.error(`Error getting Instagram posts: ${error.response?.data || error.message}`);
    throw error;
  }
};

const getPostEngagement = async (mediaId, accessToken) => {
  try {
    const response = await axios.get(
      `https://graph.instagram.com/${mediaId}`,
      {
        params: {
          fields: "id,like_count,comments_count,media_type,caption,permalink,timestamp",
          access_token: accessToken,
        },
      }
    );

    console.log(`Post ${mediaId} engagement: ${response.data.like_count} likes, ${response.data.comments_count} comments`);
    return response.data;
  } catch (error) {
    console.error(`Error getting post engagement: ${error.response?.data || error.message}`);
    throw error;
  }
};

const commentOnInstagramPost = async (mediaId, commentText, accessToken) => {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/${mediaId}/comments`,
      null,
      {
        params: {
          message: commentText,
          access_token: accessToken,
        },
      }
    );

    console.log(`Comment posted on ${mediaId}: ${commentText}`);
    return response.data;
  } catch (error) {
    console.error(`Error commenting on post: ${error.response?.data || error.message}`);
    throw error;
  }
};

const postToInstagramStory = async (userId, accessToken, imageUrl) => {
  try {
    // Create story container
    const containerRes = await axios.post(
      `https://graph.instagram.com/${userId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          media_type: "STORIES",
          access_token: accessToken,
        },
      }
    );

    const containerId = containerRes.data.id;
    console.log(`Story container created: ${containerId}`);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Publish story
    const publishRes = await axios.post(
      `https://graph.instagram.com/${userId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken,
        },
      }
    );

    const storyId = publishRes.data.id;
    console.log(`Story published: ${storyId}`);
    return storyId;
  } catch (error) {
    console.error(`Error posting to Instagram story: ${error.response?.data || error.message}`);
    throw error;
  }
};

const sendInstagramMessage = async (userId, recipientId, messageText, accessToken) => {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/${userId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: messageText },
      },
      {
        params: { access_token: accessToken },
      }
    );

    console.log(`Message sent to recipient ${recipientId}`);
    return response.data;
  } catch (error) {
    console.error(`Error sending message: ${error.response?.data || error.message}`);
    throw error;
  }
};

const getConversations = async (userId, accessToken) => {
  try {
    const { data } = await axios.get(
      `https://graph.instagram.com/${userId}/conversations`,
      {
        params: {
          platform: "instagram",
          fields: "id,participants",
          access_token: accessToken,
        },
      }
    );

    return data.data;
  } catch (error) {
    console.error(error.response?.data || error.message);
    throw error;
  }
};

export {
  commentOnInstagramPost,
  getConversations,
  getInstagramPosts,
  getPostEngagement,
  postToInstagramFeed,
  postToInstagramStory,
  sendInstagramMessage
};

