{
    'name': 'Point of Sale - Urban Piper',
    'category': 'Sales/Point of Sale',
    'description': """
This module integrates with UrbanPiper to receive and manage orders from various food delivery platforms such as Swiggy and Zomato.
    """,
    'depends': ['pos_preparation_display'],
    'data': [
        'data/res_config_settings_data.xml',
        'data/pos_account_fiscal_position_data.xml',
        'data/pos_product_pricelist_data.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/product_views.xml',
        'views/pos_payment_method_views.xml',
    ],
    'post_init_hook': '_urban_piper_pos_init',
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_urban_piper/static/src/point_of_sale_overrirde/**/*',
        ],
        'pos_preparation_display.assets': [
            'pos_urban_piper/static/src/pos_preparation_display_override/**/*',
        ]
    },
    'license': 'OEEL-1',
}
