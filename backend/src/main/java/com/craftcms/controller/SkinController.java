package com.craftcms.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/skin")
public class SkinController {

    @Value("${app.upload.path:./uploads}")
    private String uploadPath;

    @GetMapping("/{name}.png")
    public ResponseEntity<Resource> getSkin(@PathVariable String name) {
        Path skinPath = Paths.get(uploadPath, "skin", name + ".png");
        Resource resource = new FileSystemResource(skinPath);

        if (!resource.exists()) {
            // Fall back to default skin
            Path defaultPath = Paths.get(uploadPath, "skin", "default.png");
            resource = new FileSystemResource(defaultPath);
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
        }

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }
}
