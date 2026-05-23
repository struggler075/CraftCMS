package com.craftcms.dto;

import java.util.List;

public record UpdatesStatusDto(
        String status,            // "active" | "inactive" | "unconfigured"
        String message,
        boolean tokenSet,
        String githubRepo,
        String currentVersion,    // short sha of installed version, null if unknown
        boolean hasUpdates,
        List<CommitDto> pendingCommits,    // newer than current — not yet installed
        List<CommitDto> installedCommits   // current version and older
) {}
