package com.craftcms.dto;

import java.util.List;

public record UpdatesStatusDto(
        String status,      // "active" | "inactive" | "unconfigured"
        String message,
        boolean tokenSet,
        String githubRepo,
        List<CommitDto> commits
) {}
