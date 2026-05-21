package com.craftcms.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/upload")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUploadController {

    @Value("${app.upload.path:./uploads}")
    private String uploadPath;

    @PostMapping("/product-image")
    public ResponseEntity<?> uploadProductImage(@RequestParam("file") MultipartFile file) throws IOException {
        return uploadImage(file, "products");
    }

    @PostMapping("/news-image")
    public ResponseEntity<?> uploadNewsImage(@RequestParam("file") MultipartFile file) throws IOException {
        return uploadImage(file, "news");
    }

    @PostMapping("/server-image")
    public ResponseEntity<?> uploadServerImage(@RequestParam("file") MultipartFile file) throws IOException {
        return uploadImage(file, "servers");
    }

    @PostMapping("/donate-image")
    public ResponseEntity<?> uploadDonateImage(@RequestParam("file") MultipartFile file) throws IOException {
        return uploadImage(file, "donate");
    }

    @PostMapping("/site-logo")
    public ResponseEntity<?> uploadSiteLogo(@RequestParam("file") MultipartFile file) throws IOException {
        // 2 MB cap — a logo doesn't need to be huge; protects every page render
        // since the file is served from /uploads/ on cold start.
        return uploadImage(file, "site", 2 * 1024 * 1024);
    }

    private ResponseEntity<?> uploadImage(MultipartFile file, String subfolder) throws IOException {
        return uploadImage(file, subfolder, 5 * 1024 * 1024);
    }

    private ResponseEntity<?> uploadImage(MultipartFile file, String subfolder, long maxBytes) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body("File is empty");

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body("Only image files are allowed");
        }

        if (file.getSize() > maxBytes) {
            return ResponseEntity.badRequest().body("File too large (max " + (maxBytes / 1024 / 1024) + "MB)");
        }

        String originalName = file.getOriginalFilename();
        String ext = (originalName != null && originalName.contains("."))
                ? originalName.substring(originalName.lastIndexOf('.'))
                : ".png";

        Path dir = Paths.get(uploadPath, subfolder);
        Files.createDirectories(dir);

        String fileName = UUID.randomUUID() + ext;
        Path dest = dir.resolve(fileName);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

        return ResponseEntity.ok(Map.of("url", "/uploads/" + subfolder + "/" + fileName));
    }
}
