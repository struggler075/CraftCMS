package com.craftcms.service;

import com.craftcms.model.SiteSettings;
import com.craftcms.repository.SiteSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SiteSettingsService {

    private final SiteSettingsRepository repository;

    @Transactional
    public SiteSettings get() {
        return repository.findById(1L).orElseGet(() -> {
            try {
                return repository.save(SiteSettings.builder().build());
            } catch (DataIntegrityViolationException e) {
                // concurrent request already created the row
                return repository.findById(1L).orElseThrow();
            }
        });
    }

    @Transactional
    public SiteSettings update(SiteSettings incoming) {
        SiteSettings settings = get();
        if (incoming.getSiteName() != null)              settings.setSiteName(incoming.getSiteName());
        if (incoming.getSiteDescription() != null)       settings.setSiteDescription(incoming.getSiteDescription());
        if (incoming.getLogoUrl() != null)               settings.setLogoUrl(incoming.getLogoUrl());
        if (incoming.getCopyrightText() != null)         settings.setCopyrightText(incoming.getCopyrightText());
        if (incoming.getDisclaimerText() != null)        settings.setDisclaimerText(incoming.getDisclaimerText());
        if (incoming.getFooterColumnsJson() != null)     settings.setFooterColumnsJson(incoming.getFooterColumnsJson());
        if (incoming.getHeroTitle() != null)             settings.setHeroTitle(incoming.getHeroTitle());
        if (incoming.getHeroSubtitle() != null)          settings.setHeroSubtitle(incoming.getHeroSubtitle());
        if (incoming.getDonateHeaderImageUrl() != null)  settings.setDonateHeaderImageUrl(incoming.getDonateHeaderImageUrl());
        if (incoming.getSiteUrl() != null)               settings.setSiteUrl(incoming.getSiteUrl());
        settings.setEmailVerificationRequired(incoming.isEmailVerificationRequired());
        if (incoming.getBanKickMessage() != null)        settings.setBanKickMessage(incoming.getBanKickMessage());
        if (incoming.getBridgeApiKey() != null && !incoming.getBridgeApiKey().isBlank())
            settings.setBridgeApiKey(incoming.getBridgeApiKey());
        if (incoming.getBridgeAllowedIp() != null)       settings.setBridgeAllowedIp(incoming.getBridgeAllowedIp());
        if (incoming.getBridgeBackendUrl() != null)      settings.setBridgeBackendUrl(incoming.getBridgeBackendUrl());
        if (incoming.getPrimaryColor() != null)          settings.setPrimaryColor(incoming.getPrimaryColor());
        if (incoming.getBgColor() != null)               settings.setBgColor(incoming.getBgColor());
        return repository.save(settings);
    }
}
