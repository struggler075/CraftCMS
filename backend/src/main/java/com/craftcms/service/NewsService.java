package com.craftcms.service;

import com.craftcms.model.News;
import com.craftcms.repository.NewsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class NewsService {

    private final NewsRepository newsRepository;

    public Page<News> getPublished(Pageable pageable) {
        return newsRepository.findByPublishedTrueOrderByCreatedAtDesc(pageable);
    }

    public News getById(Long id) {
        return newsRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("News not found: " + id));
    }

    @Transactional
    public News create(News news) {
        return newsRepository.save(news);
    }

    @Transactional
    public News update(Long id, News updated) {
        News news = getById(id);
        news.setTitle(updated.getTitle());
        news.setContent(updated.getContent());
        news.setExcerpt(updated.getExcerpt());
        news.setImageUrl(updated.getImageUrl());
        news.setImages(updated.getImages());
        news.setCategory(updated.getCategory());
        news.setPublished(updated.getPublished());
        return newsRepository.save(news);
    }

    @Transactional
    public void delete(Long id) {
        newsRepository.deleteById(id);
    }
}
