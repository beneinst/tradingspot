<?php
// Non ci devono essere spazi o output prima di <?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://beneinst.github.io'); // oppure '*' per test
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$symbol = isset($_GET['symbol']) ? strtoupper($_GET['symbol']) : 'BTCUSDT';
$interval = isset($_GET['interval']) ? $_GET['interval'] : '4h';
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 500;

$url = "https://api.binance.com/api/v3/klines?symbol={$symbol}&interval={$interval}&limit={$limit}";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$response = curl_exec($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore nella richiesta a Binance']);
    exit;
}

echo $response;
?>

