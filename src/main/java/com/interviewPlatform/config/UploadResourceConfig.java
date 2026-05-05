package com.interviewPlatform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class UploadResourceConfig implements WebMvcConfigurer {

    @Value("${file.upload.dir:uploads/}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String dir = uploadDir;
        if (dir == null || dir.isBlank()) dir = "uploads/";
        if (!dir.endsWith("/") && !dir.endsWith("\\")) dir = dir + "/";

        // Serve uploaded files (resume/profile photos/etc.) from filesystem.
        registry.addResourceHandler("/uploads/**")
            .addResourceLocations("file:" + dir)
            .setCachePeriod(0);
    }
}

