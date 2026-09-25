plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.alentopizza.repartidor"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.alentopizza.repartidor"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"

        buildConfigField(
            "String",
            "ALENTO_BASE_URL",
            "\"https://alentopizza.com\"",
        )
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("com.google.android.gms:play-services-location:21.3.0")
}
