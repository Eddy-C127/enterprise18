import logging
import requests

_logger = logging.getLogger(__name__)


def barcode_lookup_request(url, params=None):
    '''
    Make a request to the given URL and return the response.
    '''
    if not params:
        params = {}
    response = requests.get(url, params, timeout=15)
    if response.status_code != 200:
        _logger.warning('Status code: %s with the given URL: %s', response.status_code, url)
        return False
    return response
