CREATE TABLE `historiques_affectation_transport` (
    `id` VARCHAR(191) NOT NULL,
    `abonnement_transport_id` VARCHAR(191) NOT NULL,
    `ancienne_ligne_transport_id` VARCHAR(191) NOT NULL,
    `ancien_arret_transport_id` VARCHAR(191) NULL,
    `ancienne_zone_transport` TEXT NULL,
    `nouvelle_ligne_transport_id` VARCHAR(191) NOT NULL,
    `nouvel_arret_transport_id` VARCHAR(191) NULL,
    `nouvelle_zone_transport` TEXT NULL,
    `date_effet` DATETIME(3) NOT NULL,
    `impact_tarifaire` BOOLEAN NOT NULL DEFAULT false,
    `ancien_statut` TEXT NULL,
    `nouveau_statut` TEXT NULL,
    `details_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historiques_affectation_transport_abonnement_transport_id_idx`(`abonnement_transport_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `historiques_affectation_transport`
ADD CONSTRAINT `historiques_affectation_transport_abonnement_transport_id_fkey`
FOREIGN KEY (`abonnement_transport_id`) REFERENCES `abonnements_transport`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
