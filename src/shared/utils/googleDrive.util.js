import { AUTH_KEY, GDRIVE } from "../config.js";

function handleApiError(error) {
  return new Error(error.error?.message || "Unknown Google API error." + error);
}


export default class GoogleDrive {
  constructor(authConfig = AUTH_KEY) {
    this.authConfig = authConfig;
    this.accessToken = null;
    this.expires = 0;
  }

  async authenticate() {
    if (this.expires < Date.now()) {
      const response = await fetch("https://www.googleapis.com/oauth2/v4/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.authConfig.CLIENT_ID,
          client_secret: this.authConfig.CLIENT_SECRET,
          refresh_token: this.authConfig.REFRESH_TOKEN,
          grant_type: "refresh_token",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        this.accessToken = data.access_token;
        this.expires = Date.now() + data.expires_in * 1000;
      } else {
        throw handleApiError(data);
      }
      console.debug("AccessToken Updated")
    }
    return this.accessToken;
  }

  async request(url, method = "GET", body = null) {
    const token = await this.authenticate();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const options = { method, headers, body };

    const response = await fetch(url, options);
    const data = await response.text();
    if (!response.ok) throw handleApiError(data);
    return data;
  }

  fetchFile(fileId) {
    return this.request(`${GDRIVE.API_URL}${fileId}?alt=media`);
  }

  updateFile(fileId, data) {
    return this.request(`${GDRIVE.API_URL_UPDATE}${fileId}?uploadType=media`, "PUT", data);
  }

  async uploadFile(fileName, mimeType, fileData, folderId = null) {
    const token = await this.authenticate();
    const metadata = {
      name: fileName,
      mimeType,
      parents: folderId ? [folderId] : [],
    };

    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", fileData);

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw handleApiError(data);
    return data;
  }

  async searchFiles(query) {
    const token = await this.authenticate();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    if (!response.ok) throw handleApiError(data);
    return data;
  }

  async listFiles(folderId) {
    const token = await this.authenticate();
    const query = `'${folderId}' in parents and trashed = false`;
    const fields = 'files(id,name,mimeType,createdTime,modifiedTime)';

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    if (!response.ok) throw handleApiError(data);
    return data.files || [];
  }

  async deleteFile(fileId) {
    const token = await this.authenticate();
    const response = await fetch(
      `${GDRIVE.API_URL}${fileId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    if (!response.ok) throw handleApiError(await response.text());
    return true;
  }
}
