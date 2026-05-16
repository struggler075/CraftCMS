package com.craftcms.controller;

import com.craftcms.model.News;
import com.craftcms.service.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getNews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {

        Page<News> newsPage = newsService.getPublished(PageRequest.of(page, size));

        return ResponseEntity.ok(Map.of(
                "content", newsPage.getContent(),
                "totalElements", newsPage.getTotalElements(),
                "totalPages", newsPage.getTotalPages(),
                "currentPage", newsPage.getNumber()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<News> getById(@PathVariable Long id) {
        return ResponseEntity.ok(newsService.getById(id));
    }
}
