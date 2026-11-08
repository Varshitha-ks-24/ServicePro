package com.servicepro.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI serviceProOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("ServicePro API")
                .version("0.1.0")
                .description("ServicePro backend foundation and operational APIs for the modular monolith.")
                .contact(new Contact()
                    .name("ServicePro Team")
                    .email("support@servicepro.local")));
    }
}
