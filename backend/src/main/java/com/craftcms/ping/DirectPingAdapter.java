package com.craftcms.ping;

import com.craftcms.dto.PingResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * Minecraft Server List Ping — Java Edition protocol (1.7+).
 * Sends Handshake + Status Request over raw TCP and parses the JSON response.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DirectPingAdapter implements ServerPingAdapter {

    private static final int DEFAULT_PORT = 25565;
    private static final int TIMEOUT_MS   = 5000;

    private final ObjectMapper objectMapper;

    @Override
    public PingResult ping(String address) {
        String host = address;
        int port = DEFAULT_PORT;

        if (address.contains(":")) {
            String[] parts = address.split(":", 2);
            host = parts[0].trim();
            try { port = Integer.parseInt(parts[1].trim()); }
            catch (NumberFormatException ignored) {}
        }

        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), TIMEOUT_MS);
            socket.setSoTimeout(TIMEOUT_MS);

            DataOutputStream out = new DataOutputStream(
                    new BufferedOutputStream(socket.getOutputStream()));
            DataInputStream in = new DataInputStream(
                    new BufferedInputStream(socket.getInputStream()));

            // ── Handshake packet ────────────────────────────────────────
            ByteArrayOutputStream hsBuf = new ByteArrayOutputStream();
            DataOutputStream hs = new DataOutputStream(hsBuf);
            writeVarInt(hs, 0x00);          // Packet ID: Handshake
            writeVarInt(hs, 47);            // Protocol version (1.8 — widely accepted for status)
            writeString(hs, host);
            hs.writeShort(port);            // Unsigned short, big-endian
            writeVarInt(hs, 1);             // Next state: STATUS
            hs.flush();

            byte[] hsBytes = hsBuf.toByteArray();
            writeVarInt(out, hsBytes.length);
            out.write(hsBytes);

            // ── Status Request packet ───────────────────────────────────
            writeVarInt(out, 1);    // Packet length (just the ID byte)
            writeVarInt(out, 0x00); // Packet ID: Status Request
            out.flush();

            // ── Read Status Response ────────────────────────────────────
            readVarInt(in);         // Packet length  (ignored)
            int packetId = readVarInt(in);
            if (packetId != 0x00) {
                log.warn("Direct ping {}: unexpected packet ID 0x{}", address, Integer.toHexString(packetId));
                return PingResult.offline();
            }
            String json = readString(in);
            log.debug("Direct ping {} response: {}", address, json);

            return parseJson(json);

        } catch (Exception e) {
            log.warn("Direct ping failed for {} — {} : {}", address, e.getClass().getSimpleName(), e.getMessage());
            return PingResult.offline();
        }
    }

    // ── JSON parsing — flexible, handles both string and object descriptions ──

    private PingResult parseJson(String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);

        int online = root.path("players").path("online").asInt(0);
        int max    = root.path("players").path("max").asInt(0);

        String version = null;
        JsonNode vNode = root.path("version");
        if (!vNode.isMissingNode()) version = vNode.path("name").asText(null);

        // description can be: "plain text", {"text":"..."}, or {"extra":[...]}
        String motd = null;
        JsonNode desc = root.path("description");
        if (desc.isTextual()) {
            motd = desc.asText();
        } else if (!desc.isMissingNode()) {
            motd = desc.path("text").asText(null);
        }

        return PingResult.builder()
                .online(true)
                .playersOnline(online)
                .playersMax(max)
                .version(version)
                .motd(motd)
                .build();
    }

    // ── Minecraft VarInt / String encoding ───────────────────────────────────

    private static void writeVarInt(DataOutputStream out, int value) throws IOException {
        while ((value & 0xFFFFFF80) != 0) {
            out.writeByte((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        out.writeByte(value & 0x7F);
    }

    private static int readVarInt(DataInputStream in) throws IOException {
        int result = 0, shift = 0, b;
        do {
            b = in.readUnsignedByte();
            result |= (b & 0x7F) << shift;
            shift += 7;
            if (shift >= 35) throw new IOException("VarInt too large");
        } while ((b & 0x80) != 0);
        return result;
    }

    private static void writeString(DataOutputStream out, String s) throws IOException {
        byte[] bytes = s.getBytes(StandardCharsets.UTF_8);
        writeVarInt(out, bytes.length);
        out.write(bytes);
    }

    private static String readString(DataInputStream in) throws IOException {
        int length = readVarInt(in);
        if (length < 0 || length > 2 * 1024 * 1024) {
            throw new IOException("String length out of range: " + length);
        }
        byte[] bytes = new byte[length];
        in.readFully(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
