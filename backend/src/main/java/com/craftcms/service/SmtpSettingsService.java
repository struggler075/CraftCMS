package com.craftcms.service;

import com.craftcms.model.SmtpSettings;
import com.craftcms.repository.SmtpSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SmtpSettingsService {

    private final SmtpSettingsRepository repository;

    @Transactional
    public SmtpSettings get() {
        return repository.findById(1L).orElseGet(() -> repository.save(SmtpSettings.builder().build()));
    }

    @Transactional
    public SmtpSettings update(SmtpSettings incoming) {
        SmtpSettings s = get();
        s.setEnabled(incoming.isEnabled());
        s.setSsl(incoming.isSsl());
        if (incoming.getHost() != null)      s.setHost(incoming.getHost());
        if (incoming.getPort() != null)      s.setPort(incoming.getPort());
        if (incoming.getUsername() != null)  s.setUsername(incoming.getUsername());
        if (incoming.getFromEmail() != null) s.setFromEmail(incoming.getFromEmail());
        if (incoming.getFromName() != null)  s.setFromName(incoming.getFromName());
        // Only update password if a new non-empty value is provided
        if (incoming.getPassword() != null && !incoming.getPassword().isBlank()) {
            s.setPassword(incoming.getPassword());
        }
        return repository.save(s);
    }
}
