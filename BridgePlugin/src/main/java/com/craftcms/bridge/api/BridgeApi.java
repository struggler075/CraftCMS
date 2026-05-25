package com.craftcms.bridge.api;

import com.craftcms.bridge.api.model.CartItem;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class BridgeApi {

    private final String baseUrl;
    private final String apiKey;
    private final Gson gson = new Gson();

    public BridgeApi(String baseUrl, String apiKey) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Returns true if the backend is reachable and responding.
     */
    public boolean ping() {
        try {
            HttpURLConnection conn = openConnection("/api/bridge/ping", "GET");
            int code = conn.getResponseCode();
            return code < 500;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Returns the kick message if banned, null if not banned.
     * Uses the public /ban endpoint — no API key required, global scope.
     * Throws IOException on connection failure.
     */
    public String checkBanPublic(String username) throws IOException {
        JsonObject response = getPublic("/api/bridge/player/" + encode(username) + "/ban");
        if (response.has("blocked") && response.get("blocked").getAsBoolean()) {
            return response.has("kickMessage")
                    ? response.get("kickMessage").getAsString()
                    : "§cВы заблокированы на этом сервере.";
        }
        return null;
    }

    /**
     * Returns the kick message if banned, null if not banned.
     * Throws IOException on connection failure.
     */
    public String checkBan(String username) throws IOException {
        JsonObject response = get("/api/bridge/player/" + encode(username) + "/status");
        if (response.has("blocked") && response.get("blocked").getAsBoolean()) {
            return response.has("kickMessage")
                    ? response.get("kickMessage").getAsString()
                    : "§cВы заблокированы на этом сервере.";
        }
        return null;
    }

    /** Returns pending (unclaimed) cart items for the player. */
    public List<CartItem> getCart(String username) throws IOException {
        JsonArray arr = getArray("/api/bridge/player/" + encode(username) + "/cart");
        List<CartItem> items = new ArrayList<>();
        for (int i = 0; i < arr.size(); i++) {
            items.add(gson.fromJson(arr.get(i), CartItem.class));
        }
        return items;
    }

    /**
     * Claims an order and returns the console command to execute (with substitutions applied).
     * Returns empty string if no command configured.
     */
    public String claimItem(String username, String type, long orderId) throws IOException {
        JsonObject resp = post("/api/bridge/player/" + encode(username)
                + "/cart/claim/" + type + "/" + orderId);
        return resp.has("command") ? resp.get("command").getAsString() : "";
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private JsonObject get(String path) throws IOException {
        HttpURLConnection conn = openConnection(path, "GET");
        return readObject(conn);
    }

    private JsonObject getPublic(String path) throws IOException {
        HttpURLConnection conn = openConnectionPublic(path, "GET");
        return readObject(conn);
    }

    private JsonArray getArray(String path) throws IOException {
        HttpURLConnection conn = openConnection(path, "GET");
        int status = conn.getResponseCode();
        String body = readBody(status < 400 ? conn.getInputStream() : conn.getErrorStream());
        if (status >= 400) throw new IOException("HTTP " + status + ": " + body);
        return gson.fromJson(body, JsonArray.class);
    }

    private JsonObject post(String path) throws IOException {
        HttpURLConnection conn = openConnection(path, "POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Length", "0");
        conn.getOutputStream().close();
        return readObject(conn);
    }

    private HttpURLConnection openConnection(String path, String method) throws IOException {
        URL url = new URL(baseUrl + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("X-Bridge-Key", apiKey);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        return conn;
    }

    private HttpURLConnection openConnectionPublic(String path, String method) throws IOException {
        URL url = new URL(baseUrl + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        return conn;
    }

    private JsonObject readObject(HttpURLConnection conn) throws IOException {
        int status = conn.getResponseCode();
        String body = readBody(status < 400 ? conn.getInputStream() : conn.getErrorStream());
        if (status >= 400) throw new IOException("HTTP " + status + ": " + body);
        return gson.fromJson(body, JsonObject.class);
    }

    private String readBody(InputStream stream) throws IOException {
        if (stream == null) return "";
        try (BufferedReader r = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            return sb.toString();
        }
    }

    private String encode(String s) {
        try { return java.net.URLEncoder.encode(s, "UTF-8"); }
        catch (Exception e) { return s; }
    }
}
