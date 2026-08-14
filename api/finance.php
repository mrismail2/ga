<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('finance');

        if (($_GET['view'] ?? '') === 'summary') {
            $budgetStmt = $db->prepare('SELECT `value` FROM settings WHERE `key` = ?');
            $budgetStmt->execute(['annual_budget']);
            $budget = (float)($budgetStmt->fetchColumn() ?: 0);

            $spent = (float)$db->query("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE YEAR(expense_date) = YEAR(CURDATE())")->fetchColumn();
            $byCategory   = $db->query("SELECT category, SUM(amount) AS total FROM expenses WHERE YEAR(expense_date) = YEAR(CURDATE()) GROUP BY category")->fetchAll();
            $byDepartment = $db->query("SELECT department, SUM(amount) AS total FROM expenses WHERE YEAR(expense_date) = YEAR(CURDATE()) GROUP BY department ORDER BY total DESC")->fetchAll();
            $monthly = $db->query("SELECT MONTH(expense_date) AS month, SUM(amount) AS total FROM expenses WHERE YEAR(expense_date) = YEAR(CURDATE()) GROUP BY MONTH(expense_date) ORDER BY month")->fetchAll();

            jsonResponse([
                'success'       => true,
                'annual_budget' => $budget,
                'spent'         => $spent,
                'remaining'     => $budget - $spent,
                'used_pct'      => $budget > 0 ? round($spent / $budget * 100, 1) : 0,
                'by_category'   => $byCategory,
                'by_department' => $byDepartment,
                'monthly'       => $monthly,
            ]);
        }

        $conditions = [];
        if (!empty($_GET['category'])) $conditions['category'] = $_GET['category'];
        $result = paginate('expenses', $conditions, 'expense_date DESC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('finance.manage');
        $input = getInput();
        requireFields($input, ['title','amount','expense_date']);
        if ((float)$input['amount'] <= 0) jsonError('Lacagtu waa inay ka weyn tahay eber.', 422);
        $stmt  = $db->prepare('INSERT INTO expenses (title, category, amount, department, description, expense_date, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['title'] ?? '',
            $input['category'] ?? 'Kale',
            (float)($input['amount'] ?? 0),
            $input['department'] ?? null,
            $input['description'] ?? null,
            $input['expense_date'] ?? date('Y-m-d'),
            $auth['user_id'],
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'expenses', $id, $input['title'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'DELETE':
        $auth = requireCapability('finance.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('DELETE FROM expenses WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'expenses', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
