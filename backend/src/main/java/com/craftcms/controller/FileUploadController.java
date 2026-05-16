package com.craftcms.controller;

import com.craftcms.model.User;
import com.craftcms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class FileUploadController {

    private final UserRepository userRepository;

    @Value("${app.upload.path:./uploads}")
    private String uploadPath;

    @PostMapping("/skin")
    public ResponseEntity<?> uploadSkin(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {

        return handleUpload(file, userDetails.getUsername(), "skin");
    }

    @PostMapping("/cape")
    public ResponseEntity<?> uploadCape(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) throws IOException {

        return handleUpload(file, userDetails.getUsername(), "cape");
    }

    private ResponseEntity<?> handleUpload(MultipartFile file, String username, String type) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body("File is empty");

        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("image/png")) {
            return ResponseEntity.badRequest().body("Only PNG files are allowed");
        }

        if (file.getSize() > 1024 * 1024) {
            return ResponseEntity.badRequest().body("File too large (max 1MB)");
        }

        Path dir = Paths.get(uploadPath, type);
        Files.createDirectories(dir);

        String fileName = username + ".png";
        Path dest = dir.resolve(fileName);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

        String url = "/uploads/" + type + "/" + fileName;

        User user = userRepository.findByUsername(username).orElseThrow();
        if ("skin".equals(type)) {
            user.setSkinUrl(url);
        } else {
            user.setCapeUrl(url);
        }
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("url", url));
    }
}
