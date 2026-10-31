import time
from django.core.management.base import BaseCommand
from destinations.models import Destination
from places.models import Place
from data_providers.services import PlaceIngestionService

class Command(BaseCommand):
    help = 'Refreshes place discovery data and provenance from OpenStreetMap, ASI and verified public portals with rate limiting.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--destination',
            type=str,
            default='',
            help='Optional slug of a specific destination to refresh (e.g. visakhapatnam, jaipur). If omitted, refreshes all active destinations.'
        )
        parser.add_argument(
            '--radius',
            type=int,
            default=15000,
            help='Search radius in meters around destination center (default: 15000)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=30,
            help='Maximum number of POIs to ingest per destination (default: 30)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate ingestion without writing changes to the database'
        )

    def handle(self, *args, **options):
        dest_slug = options.get('destination', '').strip().lower()
        radius = options.get('radius', 15000)
        limit = options.get('limit', 30)
        dry_run = options.get('dry_run', False)

        if dest_slug:
            destinations = list(Destination.objects.filter(slug=dest_slug))
            if not destinations:
                self.stderr.write(self.style.ERROR(f"Destination with slug '{dest_slug}' does not exist."))
                return
        else:
            destinations = list(Destination.objects.all().order_by('name'))
            if not destinations:
                self.stderr.write(self.style.WARNING("No destinations found in database."))
                return

        self.stdout.write(self.style.NOTICE(
            f"Starting external data refresh for {len(destinations)} destination(s) "
            f"(Radius: {radius}m, Limit: {limit}, Dry-Run: {dry_run})..."
        ))

        service = PlaceIngestionService()
        overall_stats = {
            'destinations_processed': 0,
            'total_retrieved': 0,
            'total_created': 0,
            'total_updated': 0,
            'total_rejected': 0,
            'errors': []
        }

        for idx, dest in enumerate(destinations, start=1):
            self.stdout.write(f"\n[{idx}/{len(destinations)}] Processing '{dest.name}' ({dest.slug})...")
            self.stdout.flush()
            
            stats = service.ingest_destination_places(
                destination_slug=dest.slug,
                radius_meters=radius,
                limit=limit,
                dry_run=dry_run
            )

            overall_stats['destinations_processed'] += 1
            overall_stats['total_retrieved'] += stats.get('retrieved', 0)
            overall_stats['total_created'] += stats.get('created', 0)
            overall_stats['total_updated'] += stats.get('updated', 0)
            overall_stats['total_rejected'] += stats.get('rejected', 0)
            if stats.get('errors'):
                overall_stats['errors'].extend(stats['errors'])

            self.stdout.write(
                f"    Retrieved: {stats.get('retrieved', 0)} | "
                f"Created: {stats.get('created', 0)} | "
                f"Updated: {stats.get('updated', 0)} | "
                f"Rejected: {stats.get('rejected', 0)}"
            )
            self.stdout.flush()

            # Polite rate-limiting between external provider calls
            if idx < len(destinations):
                time.sleep(1.0)

        self.stdout.write(self.style.SUCCESS("\n=========================================="))
        self.stdout.write(self.style.SUCCESS("    EXTERNAL DATA REFRESH COMPLETE        "))
        self.stdout.write(self.style.SUCCESS("=========================================="))
        self.stdout.write(f"Destinations Processed: {overall_stats['destinations_processed']}")
        self.stdout.write(f"Total POIs Retrieved:   {overall_stats['total_retrieved']}")
        self.stdout.write(f"Total Places Created:   {overall_stats['total_created']}")
        self.stdout.write(f"Total Places Updated:   {overall_stats['total_updated']}")
        self.stdout.write(f"Total Rejected:         {overall_stats['total_rejected']}")
        if overall_stats['errors']:
            self.stdout.write(self.style.WARNING(f"Total Warnings/Errors:  {len(overall_stats['errors'])}"))
            for err in overall_stats['errors'][:5]:
                self.stdout.write(f"  - {err}")

