{
    'name': 'Stock Barcode - Barcode Lookup',
    'category': 'Inventory/Inventory',
    'description': """
        This module allows you to create products from barcode using Barcode Lookup API Key
        if the product doesn't exists, inside barcode application.
    """,
    'depends': ['product_barcodelookup', 'stock_barcode'],
    'auto_install': True,
    'data': [
        "views/product_views.xml",
    ],
    'assets': {
        'web.assets_backend': [
            'stock_barcode_barcodelookup/static/src/**/*.js',
        ],
    },
    'license': 'OEEL-1',
}
