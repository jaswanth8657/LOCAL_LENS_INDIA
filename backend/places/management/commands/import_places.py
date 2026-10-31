from django.core.management.base import BaseCommand
from destinations.models import Destination
from data_providers.services import PlaceIngestionService

class Command(BaseCommand):
    help = 'Imports real points of interest (POIs) from OpenStreetMap Overpass API for a selected destination.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--destination',
            type=str,
            required=True,
            help='Slug of destination to import places for (e.g. visakhapatnam, jaipur)'
        )
        parser.add_argument(
            '--radius',
            type=int,
            default=12000,
            help='Search radius in meters around destination center (default: 12000)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=50,
            help='Maximum number of POI elements to query from Overpass API (default: 50)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate ingestion without writing changes to the database'
        )

    def handle(self, *args, **options):
        dest_slug = options['destination'].strip().lower()
        radius = options['radius']
        limit = options['limit']
        dry_run = options['dry_run']

        if not Destination.objects.filter(slug=dest_slug).exists():
            self.stderr.write(self.style.ERROR(f"Destination '{dest_slug}' does not exist."))
            return

        self.stdout.write(self.style.NOTICE(
            f"Querying OpenStreetMap Overpass API for '{dest_slug}' within {radius}m radius (limit: {limit})..."
        ))

        service = PlaceIngestionService()
        stats = service.ingest_destination_places(
            destination_slug=dest_slug,
            radius_meters=radius,
            limit=limit,
            dry_run=dry_run
        )

        self.stdout.write(self.style.SUCCESS("--- Ingestion Results ---"))
        self.stdout.write(f"  Destination:        {stats['destination']}")
        self.stdout.write(f"  Records Retrieved:  {stats['retrieved']}")
        self.stdout.write(f"  Records Created:    {stats['created']}")
        self.stdout.write(f"  Records Updated:    {stats['updated']}")
        self.stdout.write(f"  Duplicates Skipped: {stats['duplicates_skipped']}")
        self.stdout.write(f"  Records Rejected:   {stats['rejected']}")

        if stats['errors']:
            self.stdout.write(self.style.WARNING(f"  Provider Errors/Warnings: {len(stats['errors'])}"))
            for err in stats['errors'][:5]:
                self.stdout.write(f"    - {err}")

