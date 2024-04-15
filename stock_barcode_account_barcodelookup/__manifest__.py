{
    'name': 'Stock Barcode Account - Barcode Lookup',
    'category': 'Inventory/Inventory',
    'description': """
        This module acts as a bridge between stock barcode and account along with product lookup
        to display tax ids and tax string
    """,
    'depends': ['stock_barcode_barcodelookup', 'account'],
    'auto_install': True,
    'data': [
        "views/product_views.xml",
    ],
    'license': 'OEEL-1',
}
