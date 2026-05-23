package com.craftcms.dto;

public record CommitDto(
        String sha,
        String shortSha,
        String message,
        String author,
        String authorAvatarUrl,
        String date,
        String url,
        String type
) {}
